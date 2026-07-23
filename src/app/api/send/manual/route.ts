import { NextRequest, NextResponse } from "next/server";
import { renderTemplate, TEMPLATES } from "@/emails/registry";
import { sendEmail } from "@/lib/send";
import { COLLECTIONS, DB, Query, db } from "@/lib/appwrite";
import { AttachmentTooLargeError, cleanupAttachmentFiles, fetchAttachments, parseUploadedFiles } from "@/lib/attachments";
import { getSender, senderAddress } from "@/lib/senders";

export const maxDuration = 60;

/**
 * Manual send from the dashboard.
 * POST { to, templateKey, subject?, vars?, ignoreSuppression?,
 *        files?: [{ id: string, name: string }] }
 *
 * Suppression is respected by default; `ignoreSuppression` only works for
 * transactional templates. Attachments follow the same upload-then-reference
 * flow as the free-form compose send (see /api/send/compose).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const to = String(body.to ?? "").toLowerCase().trim();
  const entry = TEMPLATES[body.templateKey];
  const files = parseUploadedFiles(body.files);

  if (!to.includes("@") || !entry) {
    return NextResponse.json(
      { error: "a valid `to` and `templateKey` are required" },
      { status: 400 }
    );
  }

  // Optional sender override — must be on the approved list (src/lib/senders.ts).
  // Without it, the category's default from-address applies.
  let sender;
  if (body.from) {
    sender = getSender(String(body.from));
    if (!sender) {
      return NextResponse.json({ error: "from is not an approved sender account" }, { status: 400 });
    }
  }

  const vars = { email: to, ...(body.vars ?? {}) };
  const rendered = renderTemplate(body.templateKey, vars)!;

  // Link to an existing contact when there is one (for the send log).
  const contacts = await db().listDocuments(DB(), COLLECTIONS.contacts, [
    Query.equal("email", to),
    Query.limit(1),
  ]);
  const contactId = contacts.total > 0 ? contacts.documents[0].$id : undefined;

  let subject = body.subject?.trim() || rendered.defaultSubject;
  subject = subject
    .replaceAll("{{firstName}}", vars.firstName || "there")
    .replaceAll("{{company}}", vars.company || "your business");

  try {
    const attachments = await fetchAttachments(files);

    const result = await sendEmail({
      to,
      subject,
      react: rendered.element,
      category: entry.category,
      from: sender ? senderAddress(sender) : undefined,
      replyTo: sender && !sender.email.startsWith("no-reply") ? sender.email : undefined,
      templateKey: body.templateKey,
      contactId,
      skipSuppressionCheck:
        entry.category === "transactional" && body.ignoreSuppression === true,
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
