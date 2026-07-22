import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { COLLECTIONS, DB, Query, db, suppress } from "@/lib/appwrite";
import { env } from "@/lib/env";

interface ResendEvent {
  type: string;
  data: { email_id?: string; to?: string[] };
}

/**
 * Resend webhook — set the endpoint in Resend dashboard to
 * {APP_URL}/api/webhooks/resend and subscribe to delivered, opened,
 * clicked, bounced, complained events.
 */
export async function POST(req: NextRequest) {
  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ResendEvent;
  try {
    const wh = new Webhook(env.resendWebhookSecret());
    event = wh.verify(payload, headers) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const statusMap: Record<string, string> = {
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.complained": "complained",
  };
  const status = statusMap[event.type];
  const resendId = event.data.email_id;
  const to = event.data.to?.[0]?.toLowerCase();

  if (status && resendId) {
    const sends = await db().listDocuments(DB(), COLLECTIONS.sends, [
      Query.equal("resendId", resendId),
      Query.limit(1),
    ]);
    if (sends.total > 0) {
      // Don't downgrade clicked → delivered etc.
      const rank: Record<string, number> = { sent: 0, delivered: 1, opened: 2, clicked: 3, bounced: 4, complained: 5 };
      const current = (sends.documents[0] as { status?: string }).status ?? "sent";
      if ((rank[status] ?? 0) > (rank[current] ?? 0)) {
        await db().updateDocument(DB(), COLLECTIONS.sends, sends.documents[0].$id, { status });
      }
    }
  }

  // Hard protection of domain reputation: suppress bounces & complaints.
  if (to && (event.type === "email.bounced" || event.type === "email.complained")) {
    await suppress(to, event.type === "email.bounced" ? "bounce" : "complaint");
    const contacts = await db().listDocuments(DB(), COLLECTIONS.contacts, [
      Query.equal("email", to),
      Query.limit(1),
    ]);
    if (contacts.total > 0) {
      await db().updateDocument(DB(), COLLECTIONS.contacts, contacts.documents[0].$id, {
        status: event.type === "email.bounced" ? "bounced" : "complained",
      });
      // Stop any active sequences for this contact
      const enrollments = await db().listDocuments(DB(), COLLECTIONS.enrollments, [
        Query.equal("contactId", contacts.documents[0].$id),
        Query.equal("status", "active"),
        Query.limit(100),
      ]);
      for (const e of enrollments.documents) {
        await db().updateDocument(DB(), COLLECTIONS.enrollments, e.$id, { status: "stopped" });
      }
    }
  }

  return NextResponse.json({ received: true });
}
