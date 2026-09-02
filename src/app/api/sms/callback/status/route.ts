/**
 * AfroMessage `statusCallback` — GET, fired on each subsequent status
 * change. AfroMessage appends `message_id` and `status` as query params.
 * This is the essential async delivery-status path (the create callback is
 * only a safety net for a bulk-send flow this app doesn't use).
 *
 * Same secret-in-URL protection as the create callback. Idempotent —
 * duplicate deliveries for the same message_id/status are a no-op, and a
 * late stale non-terminal status never regresses an already-terminal
 * message (see lib/sms/data.ts upsertMessageStatus).
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import * as smsData from "@/lib/sms/data";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  if (url.searchParams.get("secret") !== env.afromessageCallbackSecret()) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const messageId = url.searchParams.get("message_id");
  const status = url.searchParams.get("status");
  if (!messageId || !status) {
    return new NextResponse("bad request", { status: 400 });
  }

  await smsData.upsertMessageStatus({
    providerMessageId: messageId,
    statusRaw: status,
    source: "status_callback",
  });

  return new NextResponse("ok", { status: 200 });
}
