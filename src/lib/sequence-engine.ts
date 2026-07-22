import {
  COLLECTIONS,
  DB,
  ID,
  Query,
  db,
  isSuppressed,
  type Campaign,
  type Contact,
  type Enrollment,
  type SequenceStep,
} from "./appwrite";
import { sendEmail } from "./send";
import { remainingWarmupBudget, recordWarmupSends } from "./warmup";
import { renderTemplate } from "@/emails/registry";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getSteps(sequenceId: string): Promise<SequenceStep[]> {
  const res = await db().listDocuments(DB(), COLLECTIONS.sequenceSteps, [
    Query.equal("sequenceId", sequenceId),
    Query.orderAsc("order"),
    Query.limit(100),
  ]);
  return res.documents as unknown as SequenceStep[];
}

/** Enroll a contact into a campaign's sequence. First step sends on next cron run. */
export async function enroll(contactId: string, campaign: Campaign): Promise<Enrollment> {
  const doc = await db().createDocument(DB(), COLLECTIONS.enrollments, ID.unique(), {
    contactId,
    campaignId: campaign.$id,
    sequenceId: campaign.sequenceId,
    currentStep: 0,
    status: "active",
    nextSendAt: new Date().toISOString(),
  });
  return doc as unknown as Enrollment;
}

/** Mark a contact as replied → stop all their active sequences. */
export async function stopOnReply(contactEmail: string): Promise<number> {
  const contacts = await db().listDocuments(DB(), COLLECTIONS.contacts, [
    Query.equal("email", contactEmail.toLowerCase()),
    Query.limit(1),
  ]);
  const contact = contacts.documents[0];
  if (!contact) return 0;
  const enrollments = await db().listDocuments(DB(), COLLECTIONS.enrollments, [
    Query.equal("contactId", contact.$id),
    Query.equal("status", "active"),
    Query.limit(100),
  ]);
  for (const e of enrollments.documents) {
    await db().updateDocument(DB(), COLLECTIONS.enrollments, e.$id, { status: "replied" });
  }
  return enrollments.documents.length;
}

export interface ProcessResult {
  processed: number;
  sent: number;
  completed: number;
  skipped: number;
  errors: string[];
}

/**
 * Cron worker: finds due enrollments and sends the next step of each,
 * respecting campaign daily limits and the global warm-up budget.
 */
export async function processDueEnrollments(): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, completed: 0, skipped: 0, errors: [] };

  let budget = await remainingWarmupBudget();
  if (budget <= 0) return result;

  const due = await db().listDocuments(DB(), COLLECTIONS.enrollments, [
    Query.equal("status", "active"),
    Query.lessThanEqual("nextSendAt", new Date().toISOString()),
    Query.limit(100),
  ]);

  const campaignCache = new Map<string, Campaign>();
  let warmupSent = 0;

  for (const raw of due.documents) {
    const enrollment = raw as unknown as Enrollment;
    result.processed++;
    if (budget <= 0) break;

    try {
      // Campaign must be active and under its daily limit.
      let campaign = campaignCache.get(enrollment.campaignId);
      if (!campaign) {
        campaign = (await db().getDocument(
          DB(), COLLECTIONS.campaigns, enrollment.campaignId
        )) as unknown as Campaign;
        // Reset per-day counter if date rolled over.
        if (campaign.sentTodayDate !== todayStr()) {
          campaign = (await db().updateDocument(DB(), COLLECTIONS.campaigns, campaign.$id, {
            sentToday: 0,
            sentTodayDate: todayStr(),
          })) as unknown as Campaign;
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

      if (contact.status !== "active" || (await isSuppressed(contact.email))) {
        await db().updateDocument(DB(), COLLECTIONS.enrollments, enrollment.$id, { status: "stopped" });
        result.skipped++;
        continue;
      }

      const steps = await getSteps(enrollment.sequenceId);
      const step = steps.find((s) => s.order === enrollment.currentStep) ?? steps[enrollment.currentStep];

      if (!step) {
        await db().updateDocument(DB(), COLLECTIONS.enrollments, enrollment.$id, { status: "completed" });
        result.completed++;
        continue;
      }

      const rendered = renderTemplate(step.templateKey, {
        firstName: contact.firstName || "there",
        lastName: contact.lastName,
        company: contact.company,
        email: contact.email,
      });
      if (!rendered) {
        result.errors.push(`Unknown template "${step.templateKey}" (enrollment ${enrollment.$id})`);
        continue;
      }

      const subject = step.subject
        .replaceAll("{{firstName}}", contact.firstName || "there")
        .replaceAll("{{company}}", contact.company || "your business");

      await sendEmail({
        to: contact.email,
        subject,
        react: rendered.element,
        category: campaign.type === "cold" ? "cold" : "nurture",
        contactId: contact.$id,
        campaignId: campaign.$id,
        templateKey: step.templateKey,
      });

      budget--;
      warmupSent++;
      result.sent++;

      campaign.sentToday++;
      await db().updateDocument(DB(), COLLECTIONS.campaigns, campaign.$id, {
        sentToday: campaign.sentToday,
        sentTodayDate: todayStr(),
      });

      // Advance to next step or complete.
      const next = steps.find((s) => s.order === step.order + 1);
      if (next) {
        await db().updateDocument(DB(), COLLECTIONS.enrollments, enrollment.$id, {
          currentStep: next.order,
          nextSendAt: new Date(Date.now() + next.delayHours * 3600_000).toISOString(),
        });
      } else {
        await db().updateDocument(DB(), COLLECTIONS.enrollments, enrollment.$id, { status: "completed" });
        result.completed++;
      }
    } catch (e) {
      result.errors.push(`${enrollment.$id}: ${(e as Error).message}`);
    }
  }

  if (warmupSent > 0) await recordWarmupSends(warmupSent);
  return result;
}
