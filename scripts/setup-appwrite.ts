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
  | { kind: "datetime"; key: string; required?: boolean };

async function ensureCollection(id: string, name: string, attrs: Attr[], indexes: { key: string; attributes: string[] }[] = []) {
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
    } else {
      await databases.createDatetimeAttribute(DB, id, a.key, a.required ?? false);
    }
  }
  // Attributes are created asynchronously; wait before indexing.
  await new Promise((r) => setTimeout(r, 3000));
  for (const ix of indexes) {
    try {
      await databases.createIndex(DB, id, ix.key, "key" as never, ix.attributes);
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
  ], [
    { key: "by_resendId", attributes: ["resendId"] },
    { key: "by_category", attributes: ["category"] },
  ]);

  await ensureCollection("suppressions", "Suppressions", [
    { kind: "string", key: "email", required: true, size: 320 },
    { kind: "string", key: "reason", size: 32 },
  ], [{ key: "by_email", attributes: ["email"] }]);

  await ensureCollection("warmup_state", "Warmup State", [
    { kind: "integer", key: "day", default: 1 },
    { kind: "integer", key: "targetVolume", default: 10 },
    { kind: "integer", key: "sentToday", default: 0 },
    { kind: "string", key: "date", size: 16 },
    { kind: "string", key: "status", size: 32, default: "active" },
    { kind: "datetime", key: "startedAt" },
  ]);

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
