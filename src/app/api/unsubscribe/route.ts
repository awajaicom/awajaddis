import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, Query, db, suppress } from "@/lib/appwrite";
import { env } from "@/lib/env";

async function unsubscribe(email: string) {
  await suppress(email, "unsubscribe");
  const contacts = await db().listDocuments(DB(), COLLECTIONS.contacts, [
    Query.equal("email", email),
    Query.limit(1),
  ]);
  if (contacts.total > 0) {
    await db().updateDocument(DB(), COLLECTIONS.contacts, contacts.documents[0].$id, {
      status: "unsubscribed",
    });
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

/** Link click from email footer → confirm page. */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  await unsubscribe(email);
  return NextResponse.redirect(`${env.appUrl()}/unsubscribed`);
}

/** RFC 8058 one-click unsubscribe (List-Unsubscribe-Post). */
export async function POST(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  await unsubscribe(email);
  return NextResponse.json({ ok: true });
}
