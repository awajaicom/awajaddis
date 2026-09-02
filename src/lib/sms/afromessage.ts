import { afroFetch, type AfroResult } from "./client";

/**
 * Builds a public callback URL for AfroMessage, or undefined if the app's
 * public URL or the callback secret isn't configured yet. Callback URLs are
 * optional — reads process.env directly (not the throwing lib/env.ts
 * accessors) so a missing secret/APP_URL degrades gracefully (send without
 * a callback, rely on /api/sms/reconcile to catch status later) instead of
 * throwing and failing the whole send.
 */
export function buildSmsCallbackUrl(kind: "create" | "status"): string | undefined {
  const appUrl = process.env.APP_URL;
  const secret = process.env.AFROMESSAGE_CALLBACK_SECRET;
  if (!appUrl || !secret) return undefined;
  const path = kind === "create" ? "callback/create" : "callback/status";
  return `${appUrl}/api/sms/${path}?secret=${secret}`;
}

export interface SendSmsParams {
  to: string;
  message: string;
  sender: string;
  from?: string;
  callback?: string;
}

export interface SendSmsResponse {
  status: string;
  message_id: string;
  message: string;
  to: string;
}

export async function sendSms(params: SendSmsParams): Promise<AfroResult<SendSmsResponse>> {
  return afroFetch<SendSmsResponse>("/api/send", { method: "POST", body: params });
}

export interface BulkRecipient {
  to: string;
  message?: string;
}

export interface BulkSendParams {
  /** Always the personalized per-recipient array shape — never rely on
   * AfroMessage's own contact merge fields; this app renders personalization
   * itself before sending. */
  to: BulkRecipient[];
  sender: string;
  from?: string;
  campaign: string;
  createCallback?: string;
  statusCallback?: string;
}

export interface BulkSendResponse {
  message: string;
  campaign_id: string;
}

const BULK_CHUNK_SIZE = 500; // no documented limit, start conservative

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Chunks recipients into batches of BULK_CHUNK_SIZE and issues one
 * bulk_send call per chunk, sequentially (not parallel — no documented
 * rate limit on /bulk_send, but don't assume it's unlimited either).
 * Not currently called by the sequence engine (which sends one message at
 * a time via sendSms), kept for a future one-shot broadcast feature.
 */
export async function bulkSendSms(
  params: BulkSendParams
): Promise<{ chunks: AfroResult<BulkSendResponse>[]; campaignId: string | null }> {
  const batches = chunk(params.to, BULK_CHUNK_SIZE);
  const chunks: AfroResult<BulkSendResponse>[] = [];
  let campaignId: string | null = null;

  for (const batch of batches) {
    const result = await afroFetch<BulkSendResponse>("/api/bulk_send", {
      method: "POST",
      body: {
        to: batch,
        sender: params.sender,
        from: params.from,
        campaign: params.campaign,
        createCallback: params.createCallback,
        statusCallback: params.statusCallback,
      },
    });
    chunks.push(result);
    if (result.ok && !campaignId) campaignId = result.data.campaign_id;
  }

  return { chunks, campaignId };
}

export interface SmsStatusResponse {
  messageId: string;
  cost: string;
  parts: string;
  status: string;
  description: string;
}

export async function getSmsStatus(messageId: string): Promise<AfroResult<SmsStatusResponse>> {
  return afroFetch<SmsStatusResponse>("/api/status", {
    method: "GET",
    query: { id: messageId },
  });
}

export interface SmsBalanceResponse {
  balance: string;
  estimatedMessages: string;
}

let _balanceCache: { data: SmsBalanceResponse; fetchedAt: number } | null = null;
const BALANCE_CACHE_MS = 60_000;

/** Cached ~60s — do not call per-message; pass force:true to bypass. */
export async function getSmsBalance(
  opts: { force?: boolean } = {}
): Promise<AfroResult<SmsBalanceResponse>> {
  if (!opts.force && _balanceCache && Date.now() - _balanceCache.fetchedAt < BALANCE_CACHE_MS) {
    return { ok: true, data: _balanceCache.data };
  }
  const result = await afroFetch<SmsBalanceResponse>("/api/balance", { method: "GET" });
  if (result.ok) _balanceCache = { data: result.data, fetchedAt: Date.now() };
  return result;
}
