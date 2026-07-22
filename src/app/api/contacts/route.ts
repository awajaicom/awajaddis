import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, ID, Query, db } from "@/lib/appwrite";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const queries = [Query.limit(200), Query.orderDesc("$createdAt")];
  if (status) queries.push(Query.equal("status", status));
  const res = await db().listDocuments(DB(), COLLECTIONS.contacts, queries);
  return NextResponse.json({ total: res.total, contacts: res.documents });
}

/**
 * POST — create one contact or bulk-import.
 * Body: { email, firstName, ... }  or  { contacts: [{...}, ...] }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const items = Array.isArray(body.contacts) ? body.contacts : [body];
  const created: string[] = [];
  const skipped: string[] = [];

  for (const c of items) {
    const email = String(c.email ?? "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      skipped.push(email || "(empty)");
      continue;
    }
    const dupe = await db().listDocuments(DB(), COLLECTIONS.contacts, [
      Query.equal("email", email),
      Query.limit(1),
    ]);
    if (dupe.total > 0) {
      skipped.push(email);
      continue;
    }
    const doc = await db().createDocument(DB(), COLLECTIONS.contacts, ID.unique(), {
      email,
      firstName: c.firstName ?? "",
      lastName: c.lastName ?? "",
      company: c.company ?? "",
      status: "active",
      source: c.source ?? "manual",
      tags: Array.isArray(c.tags) ? c.tags : [],
      notes: c.notes ?? "",
    });
    created.push(doc.$id);
  }
  return NextResponse.json({ created: created.length, skipped });
}
