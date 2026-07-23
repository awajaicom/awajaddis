import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, Query, db, type InboundEmail, type Send } from "@/lib/appwrite";

export interface ThreadMessage {
  id: string;
  direction: "in" | "out";
  subject: string;
  text: string;
  html: string;
  at: string;
  status?: "unread" | "read";
}

/** GET ?email=<counterparty> — merges inbound emails and inbox replies into one timeline. */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const [inbound, outbound] = await Promise.all([
    db().listDocuments(DB(), COLLECTIONS.inboundEmails, [
      Query.equal("from", email),
      Query.orderAsc("receivedAt"),
      Query.limit(200),
    ]),
    db().listDocuments(DB(), COLLECTIONS.sends, [
      Query.equal("to", email),
      Query.equal("templateKey", "inbox-reply"),
      Query.orderAsc("sentAt"),
      Query.limit(200),
    ]),
  ]);

  const messages: ThreadMessage[] = [
    ...inbound.documents.map((d): ThreadMessage => {
      const doc = d as unknown as InboundEmail;
      return {
        id: doc.$id,
        direction: "in",
        subject: doc.subject,
        text: doc.text ?? "",
        html: doc.html ?? "",
        at: doc.receivedAt,
        status: doc.status,
      };
    }),
    ...outbound.documents.map((d): ThreadMessage => {
      const doc = d as unknown as Send;
      return {
        id: doc.$id,
        direction: "out",
        subject: doc.subject,
        text: doc.body ?? "",
        html: "",
        at: doc.sentAt,
      };
    }),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return NextResponse.json({ messages });
}
