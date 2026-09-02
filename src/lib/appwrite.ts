import { Client, Databases, ID, Query, Storage } from "node-appwrite";
import { env } from "./env";

export { ID, Query };

export const ATTACHMENTS_BUCKET = () =>
  process.env.APPWRITE_ATTACHMENTS_BUCKET_ID ?? "attachments";

export const COLLECTIONS = {
  contacts: "contacts",
  campaigns: "campaigns",
  sequences: "sequences",
  sequenceSteps: "sequence_steps",
  enrollments: "enrollments",
  sends: "sends",
  suppressions: "suppressions",
  inboundEmails: "inbound_emails",
  // NB: "outreach_" prefix on these two (not the rest) is deliberate — this
  // Appwrite database is shared with the leadgen app, which already owns
  // plain "sms_campaigns"/"sms_messages" collections in a different
  // (one-shot-blast) shape. sms_events/sms_suppressions are safe to share
  // (opaque messageId keys / a global phone opt-out list is actually
  // desirable), and sms_sequences/sms_sequence_steps/sms_enrollments never
  // collided since leadgen has no drip-sequence concept.
  smsCampaigns: "outreach_sms_campaigns",
  smsSequences: "sms_sequences",
  smsSequenceSteps: "sms_sequence_steps",
  smsEnrollments: "sms_enrollments",
  smsMessages: "outreach_sms_messages",
  smsEvents: "sms_events",
  smsSuppressions: "sms_suppressions",
} as const;

let _client: Client | null = null;
let _db: Databases | null = null;
let _storage: Storage | null = null;

function client(): Client {
  if (!_client) {
    _client = new Client()
      .setEndpoint(env.appwriteEndpoint())
      .setProject(env.appwriteProjectId())
      .setKey(env.appwriteApiKey());
  }
  return _client;
}

/** Server-side Appwrite Databases client (singleton). */
export function db(): Databases {
  if (!_db) _db = new Databases(client());
  return _db;
}

/** Server-side Appwrite Storage client (singleton). */
export function storage(): Storage {
  if (!_storage) _storage = new Storage(client());
  return _storage;
}

export const DB = () => env.databaseId();

// ── Typed document shapes ─────────────────────────────────

export type ContactStatus = "active" | "unsubscribed" | "bounced" | "complained";

export interface Contact {
  $id: string;
  email: string;
  firstName: string;
  lastName?: string;
  company?: string;
  status: ContactStatus;
  source: "cold" | "lead_magnet" | "manual" | "import";
  tags: string[];
  notes?: string;
  /** Raw as entered — normalized to E.164 only at send time, see lib/sms/phone.ts. */
  phone?: string;
}

export interface Campaign {
  $id: string;
  name: string;
  type: "cold" | "lead_magnet" | "nurture";
  status: "draft" | "active" | "paused" | "completed";
  sequenceId: string;
  fromEmail: string;
  dailyLimit: number;
  sentToday: number;
  sentTodayDate: string; // YYYY-MM-DD, resets daily
}

export interface Sequence {
  $id: string;
  name: string;
  description?: string;
}

export interface SequenceStep {
  $id: string;
  sequenceId: string;
  order: number;
  templateKey: string;
  subject: string;
  delayHours: number; // delay after the previous step (0 for first step)
  condition: "always" | "no_reply" | "no_open";
}

export interface Enrollment {
  $id: string;
  contactId: string;
  campaignId: string;
  sequenceId: string;
  currentStep: number; // order of the NEXT step to send
  status: "active" | "completed" | "paused" | "replied" | "stopped";
  nextSendAt: string; // ISO datetime
}

export interface Send {
  $id: string;
  contactId: string;
  campaignId?: string;
  templateKey: string;
  subject: string;
  resendId?: string;
  category: "cold" | "lead_magnet" | "transactional" | "nurture";
  status: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained";
  sentAt: string;
  to?: string;
  /** Plain-text body — only populated for inbox replies, used to render conversation threads. */
  body?: string;
}

export interface Suppression {
  $id: string;
  email: string;
  reason: "unsubscribe" | "bounce" | "complaint" | "manual";
}

export interface InboundEmail {
  $id: string;
  $createdAt: string;
  resendId: string;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  status: "unread" | "read";
  receivedAt: string;
}

// ── SMS (AfroMessage) ───────────────────────────────────────
// Separate collections from email's Campaign/Sequence/SequenceStep/
// Enrollment/Send/Suppression above — same drip-engine shape, different
// provider and payload (plain-text bodyTemplate, no React template registry).

export interface SmsCampaign {
  $id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  sequenceId: string;
  senderName: string;
  dailyLimit: number;
  sentToday: number;
  sentTodayDate: string; // YYYY-MM-DD, resets daily
}

export interface SmsSequence {
  $id: string;
  name: string;
  description?: string;
}

export interface SmsSequenceStep {
  $id: string;
  sequenceId: string;
  order: number;
  /** Freeform text with {{firstName}}/{{company}} interpolation — no template registry. */
  bodyTemplate: string;
  delayHours: number; // delay after the previous step (0 for first step)
}

export interface SmsEnrollment {
  $id: string;
  contactId: string;
  campaignId: string;
  sequenceId: string;
  currentStep: number; // order of the NEXT step to send
  status: "active" | "completed" | "paused" | "stopped";
  nextSendAt: string; // ISO datetime
}

export type SmsMessageState = "pending" | "queued" | "delivered" | "failed";
export type SmsEventSource = "send_response" | "create_callback" | "status_callback" | "poll";
export type SmsSuppressionReason = "unsubscribe" | "manual";

export interface SmsMessage {
  $id: string;
  campaignId?: string;
  contactId?: string;
  enrollmentId?: string;
  /** AfroMessage message_id. */
  providerMessageId?: string;
  /** E.164 normalized. */
  toNumber: string;
  /** Exact text sent (post-personalization). */
  body: string;
  state: SmsMessageState;
  providerStatusRaw?: string;
  providerDescription?: string;
  parts: number;
  cost: number;
  errorCode?: string;
  errorMessage?: string;
  /** Null = never polled; reconciliation sorts these first. */
  lastPolledAt?: string;
}

/** Append-only audit trail — sms_events is the source of truth for debugging, sms_messages is the projection. */
export interface SmsEvent {
  $id: string;
  messageId: string;
  source: SmsEventSource;
  statusRaw?: string;
  payload: string;
  receivedAt: string;
}

/** Mirrors email's Suppression, keyed by phone. Deliberately never touches contacts.status — see lib/sms-sequence-engine.ts. */
export interface SmsSuppression {
  $id: string;
  phone: string;
  reason: SmsSuppressionReason;
}

// ── Helpers ───────────────────────────────────────────────

export async function listAll<T>(
  collectionId: string,
  queries: string[] = []
): Promise<T[]> {
  const res = await db().listDocuments(DB(), collectionId, [
    Query.limit(500),
    ...queries,
  ]);
  return res.documents as unknown as T[];
}

export async function isSuppressed(email: string): Promise<boolean> {
  const res = await db().listDocuments(DB(), COLLECTIONS.suppressions, [
    Query.equal("email", email.toLowerCase()),
    Query.limit(1),
  ]);
  return res.total > 0;
}

export async function suppress(
  email: string,
  reason: Suppression["reason"]
): Promise<void> {
  if (await isSuppressed(email)) return;
  await db().createDocument(DB(), COLLECTIONS.suppressions, ID.unique(), {
    email: email.toLowerCase(),
    reason,
  });
}
