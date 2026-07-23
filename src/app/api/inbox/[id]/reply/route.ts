import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import FreeForm from "@/emails/free-form";
import { sendEmail } from "@/lib/send";
import { COLLECTIONS, DB, Query, db, type InboundEmail } from "@/lib/appwrite";
import { AttachmentTooLargeError, cleanupAttachmentFiles, fetchAttachments, parseUploadedFiles } from "@/lib/attachments";
import { DEFAULT_SENDER, getSender, senderAddress } from "@/lib/senders";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/**
 * POST { message, files?: [{ id: string, name: string }] } — replies to an
 * inbound email as the mailbox it was received at. Attachments follow the
 * same upload-then-reference flow as the free-form compose send.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  const files = parseUploadedFiles(body.files);
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const email = (await db().getDocument(DB(), COLLECTIONS.inboundEmails, id)) as unknown as InboundEmail;

  const sender = getSender(email.to) ?? getSender(DEFAULT_SENDER)!;
  const subject = /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`;

  const contacts = await db().listDocuments(DB(), COLLECTIONS.contacts, [
    Query.equal("email", email.from),
    Query.limit(1),
  ]);

  try {
    const attachments = await fetchAttachments(files);

    const result = await sendEmail({
      to: email.from,
      subject,
      react: createElement(FreeForm, { body: message, email: email.from, style: "plain" }),
      category: "cold",
      from: senderAddress(sender),
      replyTo: sender.email.startsWith("no-reply") ? undefined : sender.email,
      templateKey: "inbox-reply",
      body: message,
      contactId: contacts.total > 0 ? contacts.documents[0].$id : undefined,
      headers: email.messageId
        ? { "In-Reply-To": email.messageId, References: email.messageId }
        : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (result.skipped) {
      return NextResponse.json(
        { error: `Not sent — recipient is on the suppression list (${result.skipped}).` },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, resendId: result.id, attachments: files.length });
  } catch (e) {
    if (e instanceof AttachmentTooLargeError) {
      return NextResponse.json({ error: e.message }, { status: 413 });
    }
    throw e;
  } finally {
    await cleanupAttachmentFiles(files);
  }
}
