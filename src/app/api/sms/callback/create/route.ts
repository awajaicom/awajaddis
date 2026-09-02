/**
 * AfroMessage `createCallback` — POST, fired as a message is queued.
 *
 * Our sends are always single (/api/send, one per enrollment per cron
 * tick) and get providerMessageId synchronously from the send response, so
 * this route is a thin safety net rather than a required linking step (that
 * linking dance is only needed for bulk_send, which this app doesn't call).
 *
 * Protected by an unguessable secret embedded in the URL itself (AfroMessage
 * documents no signature/shared-secret header). Must respond fast — the
 * provider's callback policy is one attempt, short timeout.
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import * as smsData from "@/lib/sms/data";

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== env.afromessageCallbackSecret()) {
    return new NextResponse("forbidden", { status: 403 });
  }

  let body: { message_id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }
  if (!body.message_id || !body.status) {
    return new NextResponse("bad request", { status: 400 });
  }

  await smsData.upsertMessageStatus({
    providerMessageId: body.message_id,
    statusRaw: body.status,
    source: "create_callback",
  });

  return new NextResponse("ok", { status: 200 });
}
