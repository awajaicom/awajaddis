import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, ID, Query, db, type Contact, type SmsCampaign } from "@/lib/appwrite";
import { enrollSms } from "@/lib/sms-sequence-engine";

export async function GET() {
  const res = await db().listDocuments(DB(), COLLECTIONS.smsCampaigns, [
    Query.limit(100),
    Query.orderDesc("$createdAt"),
  ]);
  return NextResponse.json({ campaigns: res.documents });
}

/** POST — create a campaign: { name, sequenceId, senderName?, dailyLimit? } */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.sequenceId) {
    return NextResponse.json({ error: "name and sequenceId are required" }, { status: 400 });
  }
  const doc = await db().createDocument(DB(), COLLECTIONS.smsCampaigns, ID.unique(), {
    name: body.name,
    status: "draft",
    sequenceId: body.sequenceId,
    senderName: body.senderName ?? "",
    dailyLimit: body.dailyLimit ?? 50,
    sentToday: 0,
    sentTodayDate: new Date().toISOString().slice(0, 10),
  });
  return NextResponse.json(doc);
}

/**
 * PATCH — update status/senderName or enroll contacts.
 * Body: { id, status?, senderName?, enroll?: { tag?: string, contactIds?: string[] } }
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (body.status) {
    await db().updateDocument(DB(), COLLECTIONS.smsCampaigns, body.id, { status: body.status });
  }

  if (typeof body.senderName === "string") {
    await db().updateDocument(DB(), COLLECTIONS.smsCampaigns, body.id, { senderName: body.senderName });
  }

  let enrolled = 0;
  if (body.enroll) {
    const campaign = (await db().getDocument(
      DB(), COLLECTIONS.smsCampaigns, body.id
    )) as unknown as SmsCampaign;

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
      if (c.status !== "active" || !c.phone) continue;
      const existing = await db().listDocuments(DB(), COLLECTIONS.smsEnrollments, [
        Query.equal("contactId", c.$id),
        Query.equal("campaignId", campaign.$id),
        Query.limit(1),
      ]);
      if (existing.total > 0) continue;
      await enrollSms(c.$id, campaign);
      enrolled++;
    }
  }
  return NextResponse.json({ ok: true, enrolled });
}

/**
 * DELETE — remove a campaign and its enrollments (message history is kept).
 * Body: { id }
 */
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const enrollments = await db().listDocuments(DB(), COLLECTIONS.smsEnrollments, [
    Query.equal("campaignId", body.id),
    Query.limit(500),
  ]);
  for (const e of enrollments.documents) {
    await db().deleteDocument(DB(), COLLECTIONS.smsEnrollments, e.$id);
  }

  await db().deleteDocument(DB(), COLLECTIONS.smsCampaigns, body.id);
  return NextResponse.json({ deleted: true, enrollmentsRemoved: enrollments.documents.length });
}
