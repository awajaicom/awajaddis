/**
 * One-off bulk import: Addis Ababa training institutes → contacts → a staggered
 * enrollment into the "Awaj.et Training Offer — 3-Step" SMS sequence.
 *
 * Writes to Appwrite directly rather than going through PATCH /api/sms-campaigns,
 * which enrolls sequentially with ~3 round trips per contact and would exceed the
 * serverless timeout at this batch size.
 *
 * Pacing is done by seeding each enrollment's nextSendAt rather than by leaning on
 * campaign.dailyLimit. The cap counts a UTC day (sms-sequence-engine.ts todayStr),
 * so anything it defers resurfaces at 00:00 UTC = 03:00 in Addis. Scheduling the
 * sends explicitly keeps every message inside working hours, and dailyLimit stays
 * behind it as a safety net that should never bind.
 *
 * Idempotent: contacts dedupe on the phone-derived email, the campaign is matched
 * by name, and enrollments check (contactId, campaignId) first. Re-running is safe.
 *
 * Usage:
 *   npx tsx scripts/xlsx-to-csv.ps1 …                       (see that script)
 *   npx tsx scripts/import-training-institutes.ts           dry run, writes nothing
 *   npx tsx scripts/import-training-institutes.ts --apply
 *   npx tsx scripts/import-training-institutes.ts --apply --start=2026-09-24T09:00:00+03:00
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client, Databases, ID, Query } from "node-appwrite";
import type { SmsCampaign } from "../src/lib/appwrite";
import { enrollSms } from "../src/lib/sms-sequence-engine";
import { normalizePhone } from "../src/lib/sms/phone";
import { analyzeSegments } from "../src/lib/sms/segments";

// ---------------------------------------------------------------- config

const CSV_PATH = resolve(process.cwd(), "scripts/data/training-institutes.csv");
const SEQUENCE_ID = "6ab294ad000555a69bc4"; // "Awaj.et Training Offer — 3-Step"
const CAMPAIGN_NAME = "Training Institutes — Addis (Sep 2026)";
const LIST_TAG = "list:training-institutes-2026-09";
const SOURCE_FILE = "addis_ababa_training_institutes_contact.xlsx";

/** Sender is left empty so the engine falls back to AFROMESSAGE_SENDER. */
const CAMPAIGN_SENDER_NAME = "";
/** Safety net only — above the per-day peak so the schedule below is what actually paces the send. */
const CAMPAIGN_DAILY_LIMIT = 80;

const COLLECTION_CONTACTS = "contacts";
const COLLECTION_CAMPAIGNS = "outreach_sms_campaigns";
const COLLECTION_ENROLLMENTS = "sms_enrollments";
const COLLECTION_SUPPRESSIONS = "sms_suppressions";

const EAT_OFFSET_HOURS = 3; // Africa/Addis_Ababa, no DST
const SEND_HOUR_EAT = 9;
const CRON_INTERVAL_MINUTES = 15;

// ---------------------------------------------------------------- args

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const flag = (name: string): string | undefined =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const perDay = Number(flag("per-day") ?? 75);
const perTick = Number(flag("per-tick") ?? 25);
const startFlag = flag("start");

/** Next upcoming 09:00 EAT, as a UTC instant. */
function defaultStart(): Date {
  const now = new Date();
  const candidate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      SEND_HOUR_EAT - EAT_OFFSET_HOURS,
      0,
      0,
      0
    )
  );
  if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate;
}

const startAt = startFlag ? new Date(startFlag) : defaultStart();
if (Number.isNaN(startAt.getTime())) {
  console.error(`--start is not a valid date: ${startFlag}`);
  process.exit(1);
}
if (!Number.isFinite(perDay) || perDay < 1 || !Number.isFinite(perTick) || perTick < 1) {
  console.error("--per-day and --per-tick must be positive integers");
  process.exit(1);
}

/** Renders a UTC instant in Addis local time, for a human-readable schedule. */
function eat(d: Date): string {
  const shifted = new Date(d.getTime() + EAT_OFFSET_HOURS * 3600_000);
  return `${shifted.toISOString().slice(0, 16).replace("T", " ")} EAT`;
}

// ---------------------------------------------------------------- csv

/**
 * RFC 4180 parser. The CSV carries company names containing commas, so the
 * split(",") approach used by the dashboard's CSV import would shift columns
 * and silently corrupt those rows.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

interface SourceRow {
  rowNumber: string;
  company: string;
  firstName: string;
  category: string;
  rawPhone: string;
}

function readRows(): SourceRow[] {
  const text = readFileSync(CSV_PATH, "utf8").replace(/^﻿/, "");
  const rows = parseCsv(text);
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const at = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`CSV is missing a "${name}" column (found: ${header.join(", ")})`);
    return i;
  };
  const [iNum, iCompany, iFirst, iCat, iPhone] = [
    at("#"),
    at("company"),
    at("firstname"),
    at("category"),
    at("phone"),
  ];

  return rows.slice(1).map((c) => ({
    rowNumber: (c[iNum] ?? "").trim(),
    company: (c[iCompany] ?? "").trim(),
    firstName: (c[iFirst] ?? "").trim(),
    category: (c[iCat] ?? "").trim(),
    rawPhone: (c[iPhone] ?? "").trim(),
  }));
}

// ---------------------------------------------------------------- appwrite

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);
const databases = new Databases(client);
const DB = process.env.APPWRITE_DATABASE_ID ?? "outreach";

/**
 * Retries transient network failures. A few hundred sequential calls against
 * Appwrite Cloud will occasionally hit a dropped connection ("fetch failed"),
 * and the surrounding loops are idempotent, so retrying beats aborting a
 * half-finished batch. Appwrite's own errors (4xx/5xx with a code) are thrown
 * straight through — those are real and should stop the run.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const transient = e instanceof Error && /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(e.message);
      if (!transient || i >= attempts) throw e;
      const backoffMs = 500 * 2 ** (i - 1);
      console.log(`   ⟳ ${label} failed (${e.message}), retry ${i}/${attempts - 1} in ${backoffMs}ms`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

/** Phone-derived, on a reserved TLD that can never resolve — these contacts are SMS-only. */
function syntheticEmail(normalizedPhone: string): string {
  return `${normalizedPhone.replace(/\D/g, "")}@sms.invalid`;
}

async function findContactByEmail(email: string) {
  const res = await databases.listDocuments(DB, COLLECTION_CONTACTS, [
    Query.equal("email", email),
    Query.limit(1),
  ]);
  return res.documents[0] ?? null;
}

async function findCampaignByName(name: string) {
  const res = await databases.listDocuments(DB, COLLECTION_CAMPAIGNS, [
    Query.equal("name", name),
    Query.limit(1),
  ]);
  return res.documents[0] ?? null;
}

async function isSuppressed(phone: string): Promise<boolean> {
  const res = await databases.listDocuments(DB, COLLECTION_SUPPRESSIONS, [
    Query.equal("phone", phone),
    Query.limit(1),
  ]);
  return res.total > 0;
}

async function hasEnrollment(contactId: string, campaignId: string): Promise<boolean> {
  const res = await databases.listDocuments(DB, COLLECTION_ENROLLMENTS, [
    Query.equal("contactId", contactId),
    Query.equal("campaignId", campaignId),
    Query.limit(1),
  ]);
  return res.total > 0;
}

// ---------------------------------------------------------------- main

interface Candidate extends SourceRow {
  phone: string;
  email: string;
  tags: string[];
  /** UTC instant this contact's first message becomes due. */
  sendAt: Date;
}

async function main() {
  console.log(`\n${apply ? "APPLY" : "DRY RUN"} — ${CAMPAIGN_NAME}`);
  console.log(`source: ${CSV_PATH}\n`);

  // --- parse, normalize, drop unusable rows -------------------------------
  const rows = readRows();
  const dropped: { row: SourceRow; reason: string }[] = [];
  const candidates: Candidate[] = [];
  const seenPhones = new Map<string, SourceRow>();

  for (const row of rows) {
    const phone = normalizePhone(row.rawPhone);
    if (!phone) {
      dropped.push({ row, reason: `not a valid Ethiopian mobile: "${row.rawPhone}"` });
      continue;
    }
    const firstSeen = seenPhones.get(phone);
    if (firstSeen) {
      dropped.push({ row, reason: `duplicate of ${phone} (row ${firstSeen.rowNumber} "${firstSeen.company}")` });
      continue;
    }
    seenPhones.set(phone, row);
    candidates.push({
      ...row,
      phone,
      email: syntheticEmail(phone),
      tags: ["cold", `ind:${row.category}`, LIST_TAG],
      sendAt: new Date(), // replaced below
    });
  }

  // --- assign the staggered schedule --------------------------------------
  for (const [i, c] of candidates.entries()) {
    const day = Math.floor(i / perDay);
    const tickWithinDay = Math.floor((i % perDay) / perTick);
    c.sendAt = new Date(
      startAt.getTime() + day * 86_400_000 + tickWithinDay * CRON_INTERVAL_MINUTES * 60_000
    );
  }

  console.log(`rows read:      ${rows.length}`);
  console.log(`enrollable:     ${candidates.length}`);
  console.log(`dropped:        ${dropped.length}`);
  for (const d of dropped) {
    console.log(`   row ${d.row.rowNumber.padStart(3)} — ${d.row.company}\n       ${d.reason}`);
  }

  // --- schedule summary ----------------------------------------------------
  console.log("\nschedule (first step; follow-ups land ~72h after each actual send):");
  const buckets = new Map<number, number>();
  for (const c of candidates) buckets.set(c.sendAt.getTime(), (buckets.get(c.sendAt.getTime()) ?? 0) + 1);
  for (const [ts, count] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`   ${eat(new Date(ts))}   ${String(count).padStart(3)} contacts`);
  }

  // --- cost ----------------------------------------------------------------
  const steps = await databases.listDocuments(DB, "sms_sequence_steps", [
    Query.equal("sequenceId", SEQUENCE_ID),
    Query.limit(100),
  ]);
  if (steps.total === 0) throw new Error(`sequence ${SEQUENCE_ID} has no steps`);

  // Part count is per-contact, not per-template: step 0 is Amharic (UCS-2, 67
  // chars per concatenated part) and a long institute name can tip it over a
  // part boundary. Bill each contact's actual rendered bodies.
  const ETB_PER_PART = 0.198375; // observed in outreach_sms_messages
  let totalParts = 0;
  const partsHistogram = new Map<number, number>();
  for (const c of candidates) {
    const parts = steps.documents.reduce((sum, s) => {
      const body = (s.bodyTemplate as string)
        .replaceAll("{{firstName}}", c.firstName || "there")
        .replaceAll("{{company}}", c.company || "your business");
      return sum + analyzeSegments(body).parts;
    }, 0);
    totalParts += parts;
    partsHistogram.set(parts, (partsHistogram.get(parts) ?? 0) + 1);
  }

  const spread = [...partsHistogram.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([parts, n]) => `${n}x${parts}`)
    .join(", ");
  console.log(
    `\ncost: ${steps.total} steps x ${candidates.length} contacts = ${totalParts} parts ` +
      `(${spread} parts/contact) ≈ ${(totalParts * ETB_PER_PART).toFixed(0)} ETB`
  );

  try {
    const res = await fetch(`${process.env.AFROMESSAGE_BASE_URL ?? "https://api.afromessage.com"}/api/balance`, {
      headers: { Authorization: `Bearer ${process.env.AFROMESSAGE_TOKEN}` },
    });
    const balance = (await res.json())?.response?.balance;
    if (typeof balance === "number") {
      const remaining = balance - totalParts * ETB_PER_PART;
      console.log(
        `      balance ${balance.toFixed(2)} ETB → ~${remaining.toFixed(0)} ETB left after the run` +
          (remaining < 0 ? "  ⚠️  NOT ENOUGH CREDIT" : "")
      );
    }
  } catch {
    console.log("      (balance check failed — verify credit manually before activating)");
  }

  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply.\n");
    return;
  }

  // --- create contacts ------------------------------------------------------
  console.log("\ncreating contacts…");
  let contactsCreated = 0;
  let contactsExisting = 0;
  const contactIds = new Map<string, string>(); // email -> $id

  for (const c of candidates) {
    const existing = await withRetry(`lookup ${c.email}`, () => findContactByEmail(c.email));
    if (existing) {
      contactIds.set(c.email, existing.$id);
      contactsExisting++;
      continue;
    }
    const doc = await withRetry(`create ${c.email}`, () =>
      databases.createDocument(DB, COLLECTION_CONTACTS, ID.unique(), {
        email: c.email,
        firstName: c.firstName,
        lastName: "",
        company: c.company,
        phone: c.phone,
        status: "active",
        source: "import",
        tags: c.tags,
        notes: `Imported from ${SOURCE_FILE} row ${c.rowNumber} · category: ${c.category}`,
      })
    );
    contactIds.set(c.email, doc.$id);
    contactsCreated++;
  }
  console.log(`   created ${contactsCreated}, already present ${contactsExisting}`);

  // --- campaign -------------------------------------------------------------
  let campaign = await findCampaignByName(CAMPAIGN_NAME);
  if (campaign) {
    console.log(`campaign exists: ${campaign.$id} (status: ${campaign.status})`);
  } else {
    campaign = await databases.createDocument(DB, COLLECTION_CAMPAIGNS, ID.unique(), {
      name: CAMPAIGN_NAME,
      status: "draft", // activated by hand in the UI, after the sender gate passes
      sequenceId: SEQUENCE_ID,
      senderName: CAMPAIGN_SENDER_NAME,
      dailyLimit: CAMPAIGN_DAILY_LIMIT,
      sentToday: 0,
      sentTodayDate: new Date().toISOString().slice(0, 10),
    });
    console.log(`campaign created: ${campaign.$id} (draft)`);
  }

  // --- enrollments ----------------------------------------------------------
  console.log("enrolling…");
  let enrolled = 0;
  let alreadyEnrolled = 0;
  let suppressedCount = 0;

  for (const c of candidates) {
    const contactId = contactIds.get(c.email)!;
    if (await withRetry(`suppression ${c.phone}`, () => isSuppressed(c.phone))) {
      console.log(`   skip ${c.phone} — globally suppressed`);
      suppressedCount++;
      continue;
    }
    if (await withRetry(`enrollment check ${c.phone}`, () => hasEnrollment(contactId, campaign!.$id))) {
      alreadyEnrolled++;
      continue;
    }
    await withRetry(`enroll ${c.phone}`, () =>
      enrollSms(contactId, campaign as unknown as SmsCampaign, c.sendAt.toISOString())
    );
    enrolled++;
  }

  console.log(`   enrolled ${enrolled}, already enrolled ${alreadyEnrolled}, suppressed ${suppressedCount}`);
  console.log(
    `\nDone. Campaign is in DRAFT — run the sender test, then activate it in the dashboard.\n`
  );
}

main().catch((e) => {
  console.error("\nFAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
