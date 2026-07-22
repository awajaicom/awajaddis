import { NextRequest, NextResponse } from "next/server";
import { renderTemplate, TEMPLATES } from "@/emails/registry";
import { sendEmail } from "@/lib/send";
import { env } from "@/lib/env";

/**
 * Transactional send endpoint — call this from your existing Next.js app.
 *
 *   POST /api/send/transactional
 *   Authorization: Bearer <CRON_SECRET>
 *   { "to": "user@x.com", "templateKey": "welcome" | "receipt",
 *     "subject"?: "...", "vars"?: { firstName, invoiceNumber, amount, ... } }
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const entry = TEMPLATES[body.templateKey];
  if (!body.to || !entry) {
    return NextResponse.json({ error: "to and a valid templateKey are required" }, { status: 400 });
  }
  if (entry.category !== "transactional") {
    return NextResponse.json({ error: "templateKey is not transactional" }, { status: 400 });
  }
  const rendered = renderTemplate(body.templateKey, body.vars ?? {})!;
  const { id } = await sendEmail({
    to: body.to,
    subject: body.subject ?? rendered.defaultSubject,
    react: rendered.element,
    category: "transactional",
    templateKey: body.templateKey,
    skipSuppressionCheck: true,
  });
  return NextResponse.json({ resendId: id });
}
