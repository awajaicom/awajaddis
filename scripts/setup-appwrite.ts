/**
 * One-time setup: creates the Appwrite database, collections, attributes and
 * indexes used by the outreach app.
 *
 * Usage:  cp .env.example .env  →  fill Appwrite vars  →  npm run setup:appwrite
 */
import "dotenv/config";
import { Client, Databases, ID, Permission, Role, Storage } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const DB = process.env.APPWRITE_DATABASE_ID ?? "outreach";

async function ensureDatabase() {
  try {
    await databases.get(DB);
    console.log(`✓ database "${DB}" exists`);
  } catch {
    await databases.create(DB, "Outreach");
    console.log(`+ created database "${DB}"`);
  }
}

type Attr =
  | { kind: "string"; key: string; size?: number; required?: boolean; default?: string; array?: boolean }
  | { kind: "integer"; key: string; required?: boolean; default?: number }
  | { kind: "float"; key: string; required?: boolean; default?: number }
  | { kind: "datetime"; key: string; required?: boolean };

async function ensureCollection(
  id: string,
  name: string,
  attrs: Attr[],
  indexes: { key: string; attributes: string[]; unique?: boolean }[] = []
) {
  try {
    await databases.getCollection(DB, id);
    console.log(`✓ collection "${id}" exists`);
    return;
  } catch {
    await databases.createCollection(DB, id, name);
    console.log(`+ created collection "${id}"`);
  }
  for (const a of attrs) {
    if (a.kind === "string") {
      await databases.createStringAttribute(DB, id, a.key, a.size ?? 255, a.required ?? false, a.default, a.array ?? false);
    } else if (a.kind === "integer") {
      await databases.createIntegerAttribute(DB, id, a.key, a.required ?? false, undefined, undefined, a.default);
    } else if (a.kind === "float") {
      await databases.createFloatAttribute(DB, id, a.key, a.required ?? false, undefined, undefined, a.default);
    } else {
      await databases.createDatetimeAttribute(DB, id, a.key, a.required ?? false);
    }
  }
  // Attributes are created asynchronously; wait before indexing.
  await new Promise((r) => setTimeout(r, 3000));
  for (const ix of indexes) {
    try {
      await databases.createIndex(DB, id, ix.key, (ix.unique ? "unique" : "key") as never, ix.attributes);
    } catch (e) {
      console.warn(`  ! index ${ix.key} on ${id}: ${(e as Error).message}`);
    }
  }
}

async function main() {
  await ensureDatabase();

  await ensureCollection("contacts", "Contacts", [
    { kind: "string", key: "email", required: true, size: 320 },
    { kind: "string", key: "firstName", size: 128 },
    { kind: "string", key: "lastName", size: 128 },
    { kind: "string", key: "company", size: 256 },
    { kind: "string", key: "status", size: 32, default: "active" },
    { kind: "string", key: "source", size: 32, default: "manual" },
    { kind: "string", key: "tags", size: 64, array: true },
    { kind: "string", key: "notes", size: 2048 },
    { kind: "string", key: "phone", size: 32 },
  ], [
    { key: "by_email", attributes: ["email"] },
    { key: "by_status", attributes: ["status"] },
  ]);

  await ensureCollection("campaigns", "Campaigns", [
    { kind: "string", key: "name", required: true, size: 256 },
    { kind: "string", key: "type", size: 32, default: "cold" },
    { kind: "string", key: "status", size: 32, default: "draft" },
    { kind: "string", key: "sequenceId", size: 64 },
    { kind: "string", key: "fromEmail", size: 320 },
    { kind: "integer", key: "dailyLimit", default: 50 },
    { kind: "integer", key: "sentToday", default: 0 },
    { kind: "string", key: "sentTodayDate", size: 16 },
  ], [{ key: "by_status", attributes: ["status"] }]);

  await ensureCollection("sequences", "Sequences", [
    { kind: "string", key: "name", required: true, size: 256 },
    { kind: "string", key: "description", size: 1024 },
  ]);

  await ensureCollection("sequence_steps", "Sequence Steps", [
    { kind: "string", key: "sequenceId", required: true, size: 64 },
    { kind: "integer", key: "order", required: true },
    { kind: "string", key: "templateKey", required: true, size: 128 },
    { kind: "string", key: "subject", required: true, size: 512 },
    { kind: "integer", key: "delayHours", default: 0 },
    { kind: "string", key: "condition", size: 32, default: "always" },
  ], [{ key: "by_sequence", attributes: ["sequenceId"] }]);

  await ensureCollection("enrollments", "Enrollments", [
    { kind: "string", key: "contactId", required: true, size: 64 },
    { kind: "string", key: "campaignId", required: true, size: 64 },
    { kind: "string", key: "sequenceId", required: true, size: 64 },
    { kind: "integer", key: "currentStep", default: 0 },
    { kind: "string", key: "status", size: 32, default: "active" },
    { kind: "datetime", key: "nextSendAt" },
  ], [
    { key: "by_status", attributes: ["status"] },
    { key: "by_campaign", attributes: ["campaignId"] },
  ]);

  await ensureCollection("sends", "Sends", [
    { kind: "string", key: "contactId", size: 64 },
    { kind: "string", key: "campaignId", size: 64 },
    { kind: "string", key: "templateKey", size: 128 },
    { kind: "string", key: "subject", size: 512 },
    { kind: "string", key: "resendId", size: 128 },
    { kind: "string", key: "category", size: 32 },
    { kind: "string", key: "status", size: 32, default: "sent" },
    { kind: "datetime", key: "sentAt" },
    { kind: "string", key: "to", size: 320 },
    { kind: "string", key: "body", size: 20000 },
  ], [
    { key: "by_resendId", attributes: ["resendId"] },
    { key: "by_category", attributes: ["category"] },
    { key: "by_to", attributes: ["to"] },
  ]);

  await ensureCollection("suppressions", "Suppressions", [
    { kind: "string", key: "email", required: true, size: 320 },
    { kind: "string", key: "reason", size: 32 },
  ], [{ key: "by_email", attributes: ["email"] }]);

  await ensureCollection("inbound_emails", "Inbound Emails", [
    { kind: "string", key: "resendId", required: true, size: 128 },
    { kind: "string", key: "messageId", size: 512 },
    { kind: "string", key: "from", required: true, size: 320 },
    { kind: "string", key: "to", size: 320 },
    { kind: "string", key: "subject", size: 512 },
    { kind: "string", key: "text", size: 50000 },
    { kind: "string", key: "html", size: 500000 },
    { kind: "string", key: "status", size: 16, default: "unread" },
    { kind: "datetime", key: "receivedAt" },
  ], [
    { key: "by_resendId", attributes: ["resendId"] },
    { key: "by_status", attributes: ["status"] },
  ]);

  // ── SMS (AfroMessage) ──────────────────────────────────────────────
  // Kept as separate collections rather than a `channel` field on the email
  // tables above — SMS sends are single (one AfroMessage /api/send call per
  // enrollment per cron tick), never bulk, so sms_campaigns mirrors the drip
  // `campaigns` shape, not a one-shot-blast shape.
  //
  // "outreach_sms_campaigns"/"outreach_sms_messages" are prefixed (unlike
  // the rest) because this Appwrite database is shared with the leadgen
  // app, which already owns plain "sms_campaigns"/"sms_messages"
  // collections in an incompatible one-shot-blast shape — colliding on
  // those names makes Appwrite reject every write with the drip-specific
  // fields (sequenceId, dailyLimit, enrollmentId, ...). sms_events and
  // sms_suppressions are intentionally left unprefixed and shared: a
  // messageId is an opaque unique key regardless of which app wrote it,
  // and a single global phone opt-out list is the correct compliance
  // behavior across both apps.

  await ensureCollection("outreach_sms_campaigns", "SMS Campaigns (Outreach)", [
    { kind: "string", key: "name", required: true, size: 256 },
    { kind: "string", key: "status", size: 32, default: "draft" },
    { kind: "string", key: "sequenceId", size: 64 },
    { kind: "string", key: "senderName", size: 32 },
    { kind: "integer", key: "dailyLimit", default: 50 },
    { kind: "integer", key: "sentToday", default: 0 },
    { kind: "string", key: "sentTodayDate", size: 16 },
  ], [{ key: "by_status", attributes: ["status"] }]);

  await ensureCollection("sms_sequences", "SMS Sequences", [
    { kind: "string", key: "name", required: true, size: 256 },
    { kind: "string", key: "description", size: 1024 },
  ]);

  await ensureCollection("sms_sequence_steps", "SMS Sequence Steps", [
    { kind: "string", key: "sequenceId", required: true, size: 64 },
    { kind: "integer", key: "order", required: true },
    { kind: "string", key: "bodyTemplate", required: true, size: 1600 },
    { kind: "integer", key: "delayHours", default: 0 },
  ], [{ key: "by_sequence", attributes: ["sequenceId"] }]);

  await ensureCollection("sms_enrollments", "SMS Enrollments", [
    { kind: "string", key: "contactId", required: true, size: 64 },
    { kind: "string", key: "campaignId", required: true, size: 64 },
    { kind: "string", key: "sequenceId", required: true, size: 64 },
    { kind: "integer", key: "currentStep", default: 0 },
    { kind: "string", key: "status", size: 32, default: "active" },
    { kind: "datetime", key: "nextSendAt" },
  ], [
    { key: "by_status", attributes: ["status"] },
    { key: "by_campaign", attributes: ["campaignId"] },
  ]);

  await ensureCollection("outreach_sms_messages", "SMS Messages (Outreach)", [
    { kind: "string", key: "campaignId", size: 64 },
    { kind: "string", key: "contactId", size: 64 },
    { kind: "string", key: "enrollmentId", size: 64 },
    { kind: "string", key: "providerMessageId", size: 128 },
    { kind: "string", key: "toNumber", required: true, size: 20 },
    { kind: "string", key: "body", required: true, size: 1600 },
    { kind: "string", key: "state", size: 16, default: "pending" },
    { kind: "string", key: "providerStatusRaw", size: 32 },
    { kind: "string", key: "providerDescription", size: 256 },
    { kind: "integer", key: "parts", default: 0 },
    { kind: "float", key: "cost", default: 0 },
    { kind: "string", key: "errorCode", size: 64 },
    { kind: "string", key: "errorMessage", size: 256 },
    { kind: "datetime", key: "lastPolledAt" },
  ], [
    { key: "idx_provider_message_id", attributes: ["providerMessageId"], unique: true },
    { key: "by_campaign", attributes: ["campaignId"] },
    { key: "idx_reconcile", attributes: ["state", "lastPolledAt"] },
  ]);

  await ensureCollection("sms_events", "SMS Events", [
    { kind: "string", key: "messageId", required: true, size: 64 },
    { kind: "string", key: "source", required: true, size: 32 },
    { kind: "string", key: "statusRaw", size: 32 },
    { kind: "string", key: "payload", required: true, size: 8192 },
    { kind: "datetime", key: "receivedAt", required: true },
  ], [{ key: "by_message", attributes: ["messageId"] }]);

  await ensureCollection("sms_suppressions", "SMS Suppressions", [
    { kind: "string", key: "phone", required: true, size: 20 },
    { kind: "string", key: "reason", size: 32, default: "manual" },
  ], [{ key: "idx_phone", attributes: ["phone"], unique: true }]);

  // Storage bucket for compose-tab email attachments. Anonymous users may
  // CREATE files (write-only dropbox — uploads bypass Vercel's 4.5 MB body
  // cap by going browser → Appwrite directly), but only the server API key
  // can read or delete. Files are deleted right after the email is sent.
  const storage = new Storage(client);
  const bucketId = process.env.APPWRITE_ATTACHMENTS_BUCKET_ID ?? "attachments";
  try {
    await storage.getBucket(bucketId);
    console.log(`✓ bucket "${bucketId}" exists`);
  } catch {
    await storage.createBucket(
      bucketId,
      "Email attachments",
      [Permission.create(Role.any())],
      false, // fileSecurity
      true, // enabled
      15 * 1024 * 1024 // max file size: 15 MB
    );
    console.log(`+ created bucket "${bucketId}"`);
  }

  console.log("\nDone. Collections ready — start the app with `npm run dev`.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
