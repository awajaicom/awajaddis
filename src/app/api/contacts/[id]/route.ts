import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, db } from "@/lib/appwrite";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const doc = await db().getDocument(DB(), COLLECTIONS.contacts, id);
  return NextResponse.json(doc);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ["firstName", "lastName", "company", "status", "tags", "notes"];
  const data = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );
  const doc = await db().updateDocument(DB(), COLLECTIONS.contacts, id, data);
  return NextResponse.json(doc);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db().deleteDocument(DB(), COLLECTIONS.contacts, id);
  return NextResponse.json({ deleted: true });
}
