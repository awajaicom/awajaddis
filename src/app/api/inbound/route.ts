import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { COLLECTIONS, DB, ID, Query, db } from "@/lib/appwrite";
import { env } from "@/lib/env";
import { resend } from "@/lib/send";

interface ReceivedEmailEvent {
  type: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    message_id: string;
    created_at: string;
  };
}

/**
 * Resend inbound webhook — registered in Resend as
 * {APP_URL}/api/inbound, subscribed to email.received.
 * The webhook payload only carries metadata, so the full body is fetched
 * separately via the Receiving API.
 */
export async function POST(req: NextRequest) {
  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ReceivedEmailEvent;
  try {
    const wh = new Webhook(env.resendWebhookSecret());
    event = wh.verify(payload, headers) as ReceivedEmailEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ received: true });
  }

  const { email_id, from, to, subject, message_id, created_at } = event.data;

  const existing = await db().listDocuments(DB(), COLLECTIONS.inboundEmails, [
    Query.equal("resendId", email_id),
    Query.limit(1),
  ]);
  if (existing.total > 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const { data: full } = await resend().emails.receiving.get(email_id);

  await db().createDocument(DB(), COLLECTIONS.inboundEmails, ID.unique(), {
    resendId: email_id,
    messageId: message_id ?? "",
    from,
    to: to?.[0] ?? "",
    subject: subject ?? "(no subject)",
    text: full?.text?.slice(0, 50000) ?? "",
    html: full?.html?.slice(0, 500000) ?? "",
    status: "unread",
    receivedAt: created_at ?? new Date().toISOString(),
  });

  return NextResponse.json({ received: true });
}
