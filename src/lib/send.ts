import { Resend } from "resend";
import { ReactElement } from "react";
import { env } from "./env";
import { COLLECTIONS, DB, ID, db, isSuppressed, type Send } from "./appwrite";

let _resend: Resend | null = null;
export function resend(): Resend {
  if (!_resend) _resend = new Resend(env.resendApiKey());
  return _resend;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
  category: Send["category"];
  from?: string;
  contactId?: string;
  campaignId?: string;
  templateKey: string;
  /** Transactional email must be delivered even without marketing consent. */
  skipSuppressionCheck?: boolean;
  headers?: Record<string, string>;
  /** Override the default reply-to (e.g. match the chosen sender account). */
  replyTo?: string;
  /**
   * Optional file attachments. `content` must be a base64 string — passing a
   * raw Buffer makes the SDK JSON-serialize it as a byte array, which bloats
   * the payload ~4× and causes Resend 500s on larger files.
   */
  attachments?: { filename: string; content: string }[];
}

const FROM_BY_CATEGORY: Record<Send["category"], () => string> = {
  cold: () => env.fromCold(),
  warmup: () => env.fromCold(),
  lead_magnet: () => env.fromMarketing(),
  nurture: () => env.fromMarketing(),
  transactional: () => env.fromTransactional(),
};

/**
 * Central send function. Every email in the app goes through here so that
 * suppression, logging, and List-Unsubscribe are always applied.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id: string | null; skipped?: string }> {
  const to = input.to.toLowerCase().trim();

  if (!input.skipSuppressionCheck && (await isSuppressed(to))) {
    return { id: null, skipped: "suppressed" };
  }

  const unsubscribeUrl = `${env.appUrl()}/api/unsubscribe?email=${encodeURIComponent(to)}`;
  const isMarketing = input.category !== "transactional";

  const { data, error } = await resend().emails.send({
    from: input.from ?? FROM_BY_CATEGORY[input.category](),
    to,
    subject: input.subject,
    react: input.react,
    replyTo: input.replyTo ?? env.replyTo(),
    attachments: input.attachments,
    headers: {
      ...(isMarketing
        ? {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          }
        : {}),
      ...input.headers,
    },
  });

  if (error) throw new Error(`Resend error: ${error.message}`);

  await db().createDocument(DB(), COLLECTIONS.sends, ID.unique(), {
    contactId: input.contactId ?? "",
    campaignId: input.campaignId ?? "",
    templateKey: input.templateKey,
    subject: input.subject,
    resendId: data?.id ?? "",
    category: input.category,
    status: "sent",
    sentAt: new Date().toISOString(),
  });

  return { id: data?.id ?? null };
}
