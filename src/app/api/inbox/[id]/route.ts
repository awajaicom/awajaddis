import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, db } from "@/lib/appwrite";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const doc = await db().getDocument(DB(), COLLECTIONS.inboundEmails, id);
  return NextResponse.json(doc);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  if (body.status !== "read" && body.status !== "unread") {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  await db().updateDocument(DB(), COLLECTIONS.inboundEmails, id, { status: body.status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db().deleteDocument(DB(), COLLECTIONS.inboundEmails, id);
  return NextResponse.json({ deleted: true });
}
