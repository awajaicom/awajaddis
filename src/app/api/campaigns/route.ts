import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, ID, Query, db, type Campaign, type Contact } from "@/lib/appwrite";
import { enroll } from "@/lib/sequence-engine";

export async function GET() {
  const res = await db().listDocuments(DB(), COLLECTIONS.campaigns, [
    Query.limit(100),
    Query.orderDesc("$createdAt"),
  ]);
  return NextResponse.json({ campaigns: res.documents });
}

/** POST — create a campaign: { name, type, sequenceId, fromEmail?, dailyLimit? } */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.sequenceId) {
    return NextResponse.json({ error: "name and sequenceId are required" }, { status: 400 });
  }
  const doc = await db().createDocument(DB(), COLLECTIONS.campaigns, ID.unique(), {
    name: body.name,
    type: body.type ?? "cold",
    status: "draft",
    sequenceId: body.sequenceId,
    fromEmail: body.fromEmail ?? "",
    dailyLimit: body.dailyLimit ?? 50,
    sentToday: 0,
    sentTodayDate: new Date().toISOString().slice(0, 10),
  });
  return NextResponse.json(doc);
}

/**
 * PATCH — update status or enroll contacts.
 * Body: { id, status? , enroll?: { tag?: string, contactIds?: string[] } }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (body.status) {
    await db().updateDocument(DB(), COLLECTIONS.campaigns, body.id, { status: body.status });
  }

  let enrolled = 0;
  if (body.enroll) {
    const campaign = (await db().getDocument(
      DB(), COLLECTIONS.campaigns, body.id
    )) as unknown as Campaign;

    let contacts: Contact[] = [];
    if (Array.isArray(body.enroll.contactIds)) {
      contacts = await Promise.all(
        body.enroll.contactIds.map(
          (cid: string) =>
            db().getDocument(DB(), COLLECTIONS.contacts, cid) as unknown as Promise<Contact>
        )
      );
    } else if (body.enroll.tag) {
      const res = await db().listDocuments(DB(), COLLECTIONS.contacts, [
        Query.contains("tags", body.enroll.tag),
        Query.equal("status", "active"),
        Query.limit(500),
      ]);
      contacts = res.documents as unknown as Contact[];
    }

    for (const c of contacts) {
      if (c.status !== "active") continue;
      const existing = await db().listDocuments(DB(), COLLECTIONS.enrollments, [
        Query.equal("contactId", c.$id),
        Query.equal("campaignId", campaign.$id),
        Query.limit(1),
      ]);
      if (existing.total > 0) continue;
      await enroll(c.$id, campaign);
      enrolled++;
    }
  }
  return NextResponse.json({ ok: true, enrolled });
}
