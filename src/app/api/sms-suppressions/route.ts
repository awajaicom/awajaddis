import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, Query, db } from "@/lib/appwrite";
import { stopSmsOnOptOut } from "@/lib/sms-sequence-engine";
import { normalizePhone } from "@/lib/sms/phone";
import { suppressPhone } from "@/lib/sms/data";

export async function GET() {
  const res = await db().listDocuments(DB(), COLLECTIONS.smsSuppressions, [
    Query.limit(200),
    Query.orderDesc("$createdAt"),
  ]);
  return NextResponse.json({ suppressions: res.documents });
}

/**
 * POST — manual SMS opt-out. Body: { phone }
 * Only ever writes to sms_suppressions and stops sms_enrollments — never
 * touches contacts.status or email enrollments, which are a separate
 * consent channel (see lib/sms-sequence-engine.ts stopSmsOnOptOut).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const normalized = body.phone ? normalizePhone(String(body.phone)) : null;
  if (!normalized) {
    return NextResponse.json({ error: "A valid phone number is required" }, { status: 400 });
  }
  await suppressPhone(normalized, "manual");
  const stopped = await stopSmsOnOptOut(normalized);
  return NextResponse.json({ ok: true, phone: normalized, enrollmentsStopped: stopped });
}
