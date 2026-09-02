import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, ID, Query, db } from "@/lib/appwrite";

export async function GET() {
  const [sequences, steps] = await Promise.all([
    db().listDocuments(DB(), COLLECTIONS.smsSequences, [Query.limit(100)]),
    db().listDocuments(DB(), COLLECTIONS.smsSequenceSteps, [Query.limit(500), Query.orderAsc("order")]),
  ]);
  return NextResponse.json({
    sequences: sequences.documents,
    steps: steps.documents,
  });
}

/**
 * POST — create a sequence with steps in one call.
 * Body: { name, description?, steps: [{ bodyTemplate, delayHours }] }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !Array.isArray(body.steps) || body.steps.length === 0) {
    return NextResponse.json({ error: "name and steps[] required" }, { status: 400 });
  }
  for (const s of body.steps) {
    if (!s.bodyTemplate || !String(s.bodyTemplate).trim()) {
      return NextResponse.json({ error: "Every step needs a non-empty bodyTemplate" }, { status: 400 });
    }
  }
  const seq = await db().createDocument(DB(), COLLECTIONS.smsSequences, ID.unique(), {
    name: body.name,
    description: body.description ?? "",
  });
  const created = [];
  for (let i = 0; i < body.steps.length; i++) {
    const s = body.steps[i];
    const doc = await db().createDocument(DB(), COLLECTIONS.smsSequenceSteps, ID.unique(), {
      sequenceId: seq.$id,
      order: i,
      bodyTemplate: s.bodyTemplate,
      delayHours: s.delayHours ?? (i === 0 ? 0 : 72),
    });
    created.push(doc.$id);
  }
  return NextResponse.json({ sequence: seq, stepIds: created });
}

/**
 * DELETE — remove a sequence and its steps. Blocked while any campaign
 * still references it, so a campaign never silently ends up pointing at
 * nothing. Body: { id }
 */
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const usedBy = await db().listDocuments(DB(), COLLECTIONS.smsCampaigns, [
    Query.equal("sequenceId", body.id),
    Query.limit(10),
  ]);
  if (usedBy.total > 0) {
    const names = usedBy.documents.map((c) => (c as unknown as { name: string }).name).join(", ");
    return NextResponse.json(
      { error: `Still used by campaign(s): ${names}. Delete or reassign them first.` },
      { status: 409 }
    );
  }

  const steps = await db().listDocuments(DB(), COLLECTIONS.smsSequenceSteps, [
    Query.equal("sequenceId", body.id),
    Query.limit(500),
  ]);
  for (const s of steps.documents) {
    await db().deleteDocument(DB(), COLLECTIONS.smsSequenceSteps, s.$id);
  }

  await db().deleteDocument(DB(), COLLECTIONS.smsSequences, body.id);
  return NextResponse.json({ deleted: true, stepsRemoved: steps.documents.length });
}
