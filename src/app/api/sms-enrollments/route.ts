import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, Query, db, listAll, type Contact, type SmsEnrollment } from "@/lib/appwrite";

/**
 * GET ?campaignId=... — list enrollments for one campaign, joined with a
 * minimal contact projection, for the "Enrolled contacts" panel on the SMS
 * campaign card.
 */
export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  const enrollments = await listAll<SmsEnrollment>(COLLECTIONS.smsEnrollments, [
    Query.equal("campaignId", campaignId),
  ]);

  const contactIds = [...new Set(enrollments.map((e) => e.contactId))];
  const contacts = contactIds.length
    ? await listAll<Contact>(COLLECTIONS.contacts, [Query.equal("$id", contactIds)])
    : [];
  const contactById = new Map(contacts.map((c) => [c.$id, c]));

  return NextResponse.json({
    enrollments: enrollments.map((e) => {
      const c = contactById.get(e.contactId);
      return {
        $id: e.$id,
        currentStep: e.currentStep,
        status: e.status,
        nextSendAt: e.nextSendAt,
        contact: c ? { firstName: c.firstName, lastName: c.lastName, phone: c.phone } : null,
      };
    }),
  });
}

const ALLOWED_STATUSES = new Set(["active", "stopped"]);

/**
 * PATCH { id, status: "active" | "stopped" } — stop or resume ONE
 * enrollment in ONE campaign (e.g. a contact already converted/replied and
 * shouldn't get the rest of this specific sequence). Deliberately narrower
 * than the global opt-out in api/sms-suppressions/route.ts: never touches
 * sms_suppressions, the contact's other campaigns, or message history in
 * outreach_sms_messages (always preserved, same convention as campaign/
 * sequence delete). "completed" is engine-owned and "paused" is unused on
 * the SMS side, so both are rejected here.
 *
 * A resumed enrollment could theoretically race the cron worker mid-tick;
 * the only overlap is cosmetic (ending up "completed" instead of
 * "stopped"), since the cron only ever scans status="active" either way —
 * same accepted tradeoff as stopSmsOnOptOut(), no locking needed.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id || !ALLOWED_STATUSES.has(body.status)) {
    return NextResponse.json({ error: "id and a valid status (active|stopped) are required" }, { status: 400 });
  }

  await db().updateDocument(
    DB(),
    COLLECTIONS.smsEnrollments,
    body.id,
    body.status === "active"
      ? { status: "active", nextSendAt: new Date().toISOString() }
      : { status: "stopped" }
  );

  return NextResponse.json({ ok: true });
}
