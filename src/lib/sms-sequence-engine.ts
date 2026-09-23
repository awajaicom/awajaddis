import {
  COLLECTIONS,
  DB,
  ID,
  Query,
  db,
  listAll,
  type Contact,
  type SmsCampaign,
  type SmsEnrollment,
  type SmsSequenceStep,
} from "./appwrite";
import { env } from "./env";
import { buildSmsCallbackUrl, sendSms } from "./sms/afromessage";
import { createSmsMessageRow, isPhoneSuppressed, markMessageFailed, setMessageProviderId } from "./sms/data";
import { normalizePhone } from "./sms/phone";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function interpolate(text: string, contact: Contact): string {
  return text
    .replaceAll("{{firstName}}", contact.firstName || "there")
    .replaceAll("{{company}}", contact.company || "your business");
}

async function getSteps(sequenceId: string): Promise<SmsSequenceStep[]> {
  const res = await db().listDocuments(DB(), COLLECTIONS.smsSequenceSteps, [
    Query.equal("sequenceId", sequenceId),
    Query.orderAsc("order"),
    Query.limit(100),
  ]);
  return res.documents as unknown as SmsSequenceStep[];
}

/**
 * Enroll a contact into an SMS campaign's sequence. First step sends on the
 * next cron run by default; pass nextSendAt to schedule it instead, which is
 * how a bulk import paces a large batch across days and cron ticks rather
 * than dumping every enrollment as due-now and leaning on dailyLimit.
 */
export async function enrollSms(
  contactId: string,
  campaign: SmsCampaign,
  nextSendAt: string = new Date().toISOString()
): Promise<SmsEnrollment> {
  const doc = await db().createDocument(DB(), COLLECTIONS.smsEnrollments, ID.unique(), {
    contactId,
    campaignId: campaign.$id,
    sequenceId: campaign.sequenceId,
    currentStep: 0,
    status: "active",
    nextSendAt,
  });
  return doc as unknown as SmsEnrollment;
}

/**
 * Manual opt-out → stop all of this phone's active SMS enrollments. Only
 * touches sms_enrollments — never contacts.status or email enrollments,
 * which are a separate consent channel (see api/sms-suppressions/route.ts).
 * Matches by normalizing every contact's stored phone in memory, since
 * contacts.phone is kept as raw entered text (normalized at send time only)
 * and Appwrite can't query through a normalization function.
 */
export async function stopSmsOnOptOut(normalizedPhone: string): Promise<number> {
  const contacts = await listAll<Contact>(COLLECTIONS.contacts);
  const matches = contacts.filter((c) => c.phone && normalizePhone(c.phone) === normalizedPhone);

  let stopped = 0;
  for (const contact of matches) {
    const enrollments = await db().listDocuments(DB(), COLLECTIONS.smsEnrollments, [
      Query.equal("contactId", contact.$id),
      Query.equal("status", "active"),
      Query.limit(100),
    ]);
    for (const e of enrollments.documents) {
      await db().updateDocument(DB(), COLLECTIONS.smsEnrollments, e.$id, { status: "stopped" });
      stopped++;
    }
  }
  return stopped;
}

export interface SmsProcessResult {
  processed: number;
  sent: number;
  completed: number;
  skipped: number;
  errors: string[];
}

/**
 * Cron worker: finds due SMS enrollments and sends the next step of each,
 * respecting campaign daily limits. One AfroMessage single-send per
 * enrollment per tick — never bulk_send. No warmup-budget integration:
 * AfroMessage's own credit balance (see api/sms/balance) plus each
 * campaign's dailyLimit are the throttle, same mechanism as email campaigns.
 */
export async function processDueSmsEnrollments(): Promise<SmsProcessResult> {
  const result: SmsProcessResult = { processed: 0, sent: 0, completed: 0, skipped: 0, errors: [] };

  const due = await db().listDocuments(DB(), COLLECTIONS.smsEnrollments, [
    Query.equal("status", "active"),
    Query.lessThanEqual("nextSendAt", new Date().toISOString()),
    Query.limit(100),
  ]);

  const campaignCache = new Map<string, SmsCampaign>();

  for (const raw of due.documents) {
    const enrollment = raw as unknown as SmsEnrollment;
    result.processed++;

    try {
      // Campaign must be active and under its daily limit.
      let campaign = campaignCache.get(enrollment.campaignId);
      if (!campaign) {
        campaign = (await db().getDocument(
          DB(), COLLECTIONS.smsCampaigns, enrollment.campaignId
        )) as unknown as SmsCampaign;
        // Reset per-day counter if date rolled over.
        if (campaign.sentTodayDate !== todayStr()) {
          campaign = (await db().updateDocument(DB(), COLLECTIONS.smsCampaigns, campaign.$id, {
            sentToday: 0,
            sentTodayDate: todayStr(),
          })) as unknown as SmsCampaign;
        }
        campaignCache.set(campaign.$id, campaign);
      }
      if (campaign.status !== "active" || campaign.sentToday >= campaign.dailyLimit) {
        result.skipped++;
        continue;
      }

      const contact = (await db().getDocument(
        DB(), COLLECTIONS.contacts, enrollment.contactId
      )) as unknown as Contact;

      const phone = contact.phone ? normalizePhone(contact.phone) : null;

      if (contact.status !== "active" || !phone || (await isPhoneSuppressed(phone))) {
        await db().updateDocument(DB(), COLLECTIONS.smsEnrollments, enrollment.$id, { status: "stopped" });
        result.skipped++;
        continue;
      }

      const steps = await getSteps(enrollment.sequenceId);
      const step = steps.find((s) => s.order === enrollment.currentStep) ?? steps[enrollment.currentStep];

      if (!step) {
        await db().updateDocument(DB(), COLLECTIONS.smsEnrollments, enrollment.$id, { status: "completed" });
        result.completed++;
        continue;
      }

      const body = interpolate(step.bodyTemplate, contact);

      // Persist before send — a crash mid-send must leave a recoverable trace.
      const messageRow = await createSmsMessageRow({
        campaignId: campaign.$id,
        contactId: contact.$id,
        enrollmentId: enrollment.$id,
        toNumber: phone,
        body,
      });

      if (!env.smsEnabled() || env.smsDryRun()) {
        // Dry-run: leave the message row pending with no provider id, but
        // still advance the step/nextSendAt below so drip timing is
        // testable without ever calling AfroMessage.
      } else {
        const sent = await sendSms({
          to: phone,
          message: body,
          sender: campaign.senderName || env.afromessageSender(),
          from: env.afromessageIdentifierId(),
          callback: buildSmsCallbackUrl("status"),
        });

        if (!sent.ok) {
          await markMessageFailed(messageRow.$id, sent.code, sent.message);
          result.errors.push(`${enrollment.$id}: ${sent.message}`);
          continue; // do not advance — stays due, retried next tick
        }
        await setMessageProviderId(messageRow.$id, sent.data.message_id);
      }

      result.sent++;

      campaign.sentToday++;
      await db().updateDocument(DB(), COLLECTIONS.smsCampaigns, campaign.$id, {
        sentToday: campaign.sentToday,
        sentTodayDate: todayStr(),
      });

      // Advance to next step or complete.
      const next = steps.find((s) => s.order === step.order + 1);
      if (next) {
        await db().updateDocument(DB(), COLLECTIONS.smsEnrollments, enrollment.$id, {
          currentStep: next.order,
          nextSendAt: new Date(Date.now() + next.delayHours * 3600_000).toISOString(),
        });
      } else {
        await db().updateDocument(DB(), COLLECTIONS.smsEnrollments, enrollment.$id, { status: "completed" });
        result.completed++;
      }
    } catch (e) {
      result.errors.push(`${enrollment.$id}: ${(e as Error).message}`);
    }
  }

  return result;
}
