import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, ID, Query, db } from "@/lib/appwrite";
import { TEMPLATES } from "@/emails/registry";

export async function GET() {
  const [sequences, steps] = await Promise.all([
    db().listDocuments(DB(), COLLECTIONS.sequences, [Query.limit(100)]),
    db().listDocuments(DB(), COLLECTIONS.sequenceSteps, [Query.limit(500), Query.orderAsc("order")]),
  ]);
  return NextResponse.json({
    sequences: sequences.documents,
    steps: steps.documents,
    availableTemplates: Object.entries(TEMPLATES).map(([key, t]) => ({
      key,
      defaultSubject: t.defaultSubject,
      category: t.category,
      description: t.description,
    })),
  });
}

/**
 * POST — create a sequence with steps in one call.
 * Body: { name, description?, steps: [{ templateKey, subject?, delayHours, condition? }] }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !Array.isArray(body.steps) || body.steps.length === 0) {
    return NextResponse.json({ error: "name and steps[] required" }, { status: 400 });
  }
  for (const s of body.steps) {
    if (!TEMPLATES[s.templateKey]) {
      return NextResponse.json({ error: `Unknown templateKey: ${s.templateKey}` }, { status: 400 });
    }
  }
  const seq = await db().createDocument(DB(), COLLECTIONS.sequences, ID.unique(), {
    name: body.name,
    description: body.description ?? "",
  });
  const created = [];
  for (let i = 0; i < body.steps.length; i++) {
    const s = body.steps[i];
    const doc = await db().createDocument(DB(), COLLECTIONS.sequenceSteps, ID.unique(), {
      sequenceId: seq.$id,
      order: i,
      templateKey: s.templateKey,
      subject: s.subject ?? TEMPLATES[s.templateKey].defaultSubject,
      delayHours: s.delayHours ?? (i === 0 ? 0 : 72),
      condition: s.condition ?? "always",
    });
    created.push(doc.$id);
  }
  return NextResponse.json({ sequence: seq, stepIds: created });
}
