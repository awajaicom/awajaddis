import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import FreeForm from "@/emails/free-form";
import { sendEmail } from "@/lib/send";
import { ATTACHMENTS_BUCKET, COLLECTIONS, DB, Query, db, storage } from "@/lib/appwrite";
import { DEFAULT_SENDER, getSender, senderAddress } from "@/lib/senders";

export const maxDuration = 60;

/** Keep well under Resend's 40 MB total-message cap (base64 adds ~33%). */
const MAX_TOTAL_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/**
 * Free-form manual send. Attachments are NOT uploaded here — the browser
 * uploads them straight to Appwrite Storage (bypassing Vercel's 4.5 MB body
 * cap) and this route receives only their file IDs, downloads them
 * server-side, attaches, and deletes them from the bucket afterwards.
 *
 * POST JSON:
 *   { to, subject, body, style?: "plain"|"branded",
 *     files?: [{ id: string, name: string }] }
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const to = String(payload.to ?? "").toLowerCase().trim();
  const subject = String(payload.subject ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const style = payload.style === "branded" ? "branded" : "plain";
  const files: { id: string; name: string }[] = Array.isArray(payload.files)
    ? payload.files.filter((f: { id?: unknown; name?: unknown }) => typeof f.id === "string" && typeof f.name === "string")
    : [];

  if (!to.includes("@") || !subject || !body) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
  }

  // Sender must be on the approved list (src/lib/senders.ts).
  const sender = getSender(String(payload.from ?? DEFAULT_SENDER));
  if (!sender) {
    return NextResponse.json({ error: "from is not an approved sender account" }, { status: 400 });
  }

  const bucket = ATTACHMENTS_BUCKET();
  const cleanup = () =>
    Promise.allSettled(files.map((f) => storage().deleteFile(bucket, f.id)));

  try {
    // Validate sizes from metadata before downloading anything.
    let total = 0;
    for (const f of files) {
      const meta = await storage().getFile(bucket, f.id);
      total += meta.sizeOriginal;
    }
    if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
      await cleanup();
      return NextResponse.json(
        { error: `Attachments too large (${(total / 1024 / 1024).toFixed(1)} MB). Max 15 MB total.` },
        { status: 413 }
      );
    }

    const attachments = await Promise.all(
      files.map(async (f) => ({
        filename: f.name,
        content: Buffer.from(await storage().getFileDownload(bucket, f.id)).toString("base64"),
      }))
    );

    const contacts = await db().listDocuments(DB(), COLLECTIONS.contacts, [
      Query.equal("email", to),
      Query.limit(1),
    ]);

    const result = await sendEmail({
      to,
      subject,
      react: createElement(FreeForm, { body, email: to, style }),
      category: style === "branded" ? "nurture" : "cold",
      from: senderAddress(sender),
      // Replies go to the chosen account (except no-reply, which keeps the default).
      replyTo: sender.email.startsWith("no-reply") ? undefined : sender.email,
      templateKey: "compose",
      contactId: contacts.total > 0 ? contacts.documents[0].$id : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (result.skipped) {
      return NextResponse.json(
        { error: `Not sent — recipient is on the suppression list (${result.skipped}).` },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, resendId: result.id, attachments: files.length });
  } finally {
    await cleanup();
  }
}
