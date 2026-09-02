import { COLLECTIONS, DB, ID, Query, db, listAll } from "@/lib/appwrite";
import type {
  SmsEvent,
  SmsEventSource,
  SmsMessage,
  SmsMessageState,
  SmsSuppression,
  SmsSuppressionReason,
} from "@/lib/appwrite";
import { classify } from "./statusMap";

// ── Suppressions ──────────────────────────────────────────

export async function isPhoneSuppressed(phone: string): Promise<boolean> {
  const res = await db().listDocuments(DB(), COLLECTIONS.smsSuppressions, [
    Query.equal("phone", phone),
    Query.limit(1),
  ]);
  return res.total > 0;
}

export async function suppressPhone(phone: string, reason: SmsSuppressionReason): Promise<void> {
  if (await isPhoneSuppressed(phone)) return;
  await db().createDocument(DB(), COLLECTIONS.smsSuppressions, ID.unique(), {
    phone,
    reason,
  });
}

/** For UI display only (greying out opted-out contacts in a picker) — the
 * real enforcement is the per-phone check in isPhoneSuppressed, called
 * server-side in the actual send path. */
export async function listSuppressedPhones(): Promise<Set<string>> {
  const rows = await listAll<SmsSuppression>(COLLECTIONS.smsSuppressions);
  return new Set(rows.map((r) => r.phone));
}

// ── Messages ──────────────────────────────────────────────

/** Persist a message row BEFORE calling the provider — a crash mid-send must leave a recoverable trace, not an invisible charge. */
export async function createSmsMessageRow(input: {
  campaignId?: string;
  contactId?: string;
  enrollmentId?: string;
  toNumber: string;
  body: string;
}): Promise<SmsMessage> {
  return (await db().createDocument(DB(), COLLECTIONS.smsMessages, ID.unique(), {
    campaignId: input.campaignId,
    contactId: input.contactId,
    enrollmentId: input.enrollmentId,
    toNumber: input.toNumber,
    body: input.body,
    state: "pending",
    parts: 0,
    cost: 0,
  })) as unknown as SmsMessage;
}

export async function setMessageProviderId(messageId: string, providerMessageId: string): Promise<void> {
  await db().updateDocument(DB(), COLLECTIONS.smsMessages, messageId, { providerMessageId });
}

export async function markMessageFailed(
  messageId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await db().updateDocument(DB(), COLLECTIONS.smsMessages, messageId, {
    state: "failed",
    errorCode: errorCode.slice(0, 64),
    errorMessage: errorMessage.slice(0, 256),
  });
}

export async function findMessageByProviderId(providerMessageId: string): Promise<SmsMessage | null> {
  const res = await db().listDocuments(DB(), COLLECTIONS.smsMessages, [
    Query.equal("providerMessageId", providerMessageId),
    Query.limit(1),
  ]);
  return (res.documents[0] as unknown as SmsMessage) ?? null;
}

export async function getSmsMessagesForCampaign(campaignId: string): Promise<SmsMessage[]> {
  return listAll<SmsMessage>(COLLECTIONS.smsMessages, [
    Query.equal("campaignId", campaignId),
    Query.orderDesc("$createdAt"),
  ]);
}

function isTerminal(state: SmsMessageState): boolean {
  return state === "delivered" || state === "failed";
}

/**
 * Idempotent upsert keyed on providerMessageId, shared by both callback
 * routes and the reconciliation poll so the safety logic isn't duplicated:
 * - A duplicate callback for the same message_id/status is a no-op.
 * - A stale non-terminal update never regresses an already-terminal state.
 * Always appends an sms_events row regardless (append-only audit trail).
 */
export async function upsertMessageStatus(input: {
  providerMessageId: string;
  statusRaw: string;
  description?: string;
  parts?: number;
  cost?: number;
  source: SmsEventSource;
}): Promise<{ messageId: string | null; changed: boolean }> {
  const existing = await findMessageByProviderId(input.providerMessageId);
  if (!existing) {
    // Nothing to attach the event to — most likely a callback for a
    // message this app never created a row for. Nothing else to do.
    return { messageId: null, changed: false };
  }

  const rawUpper = input.statusRaw.toUpperCase();
  const nextState: SmsMessageState =
    input.source === "create_callback" && rawUpper === "QUEUED" ? "queued" : classify(input.statusRaw);

  const wasTerminal = isTerminal(existing.state);
  const regress = wasTerminal && !isTerminal(nextState);

  if (!regress) {
    await db().updateDocument(DB(), COLLECTIONS.smsMessages, existing.$id, {
      state: nextState,
      providerStatusRaw: input.statusRaw,
      providerDescription: input.description ?? existing.providerDescription,
      parts: input.parts ?? existing.parts,
      cost: input.cost ?? existing.cost,
      lastPolledAt: input.source === "poll" ? new Date().toISOString() : existing.lastPolledAt,
    });
  }

  await appendSmsEvent({
    messageId: existing.$id,
    source: input.source,
    statusRaw: input.statusRaw,
    payload: input,
  });

  return { messageId: existing.$id, changed: !regress };
}

// ── Events (append-only) ──────────────────────────────────

export async function appendSmsEvent(input: {
  messageId: string;
  source: SmsEventSource;
  statusRaw?: string;
  payload: unknown;
}): Promise<void> {
  await db().createDocument(DB(), COLLECTIONS.smsEvents, ID.unique(), {
    messageId: input.messageId,
    source: input.source,
    statusRaw: input.statusRaw,
    payload: JSON.stringify(input.payload).slice(0, 8192),
    receivedAt: new Date().toISOString(),
  });
}

export async function getSmsEventsForMessage(messageId: string): Promise<SmsEvent[]> {
  return listAll<SmsEvent>(COLLECTIONS.smsEvents, [
    Query.equal("messageId", messageId),
    Query.orderDesc("receivedAt"),
  ]);
}

// ── Reconciliation query ──────────────────────────────────

/**
 * Non-terminal messages (pending or queued) whose lastPolledAt is older
 * than `olderThanMs`, oldest-first (never-polled rows sort first), capped
 * at `limit`. Never poll on a page render or per-row in a UI list — this
 * is a background reconciliation query only, consumed by the cron route.
 */
export async function listMessagesDueForReconciliation(
  olderThanMs: number,
  limit: number
): Promise<SmsMessage[]> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const nonTerminalStates: SmsMessageState[] = ["pending", "queued"];

  const batches = await Promise.all(
    nonTerminalStates.flatMap((state) => [
      db().listDocuments(DB(), COLLECTIONS.smsMessages, [
        Query.equal("state", state),
        Query.isNull("lastPolledAt"),
        Query.limit(limit),
      ]),
      db().listDocuments(DB(), COLLECTIONS.smsMessages, [
        Query.equal("state", state),
        Query.lessThanEqual("lastPolledAt", cutoff),
        Query.limit(limit),
      ]),
    ])
  );

  const byId = new Map<string, SmsMessage>();
  for (const batch of batches) {
    for (const doc of batch.documents as unknown as SmsMessage[]) {
      byId.set(doc.$id, doc);
    }
  }

  return [...byId.values()]
    .sort((a, b) => (a.lastPolledAt ?? "").localeCompare(b.lastPolledAt ?? ""))
    .slice(0, limit);
}
