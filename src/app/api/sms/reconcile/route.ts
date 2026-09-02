/**
 * SMS status-polling reconciliation — background fallback for missed
 * callbacks (expected, not exceptional). Bearer-CRON_SECRET cron endpoint,
 * same pattern as api/cron/process-sms-sequences.
 *
 * Rate limit is a hard constraint: AfroMessage allows ~30 /status requests
 * per minute; exceeding it blocks further calls for 2 minutes. This route
 * serializes calls with an explicit 2s sleep between each, within one
 * invocation — never call /status on a page render or per-row in a UI list.
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSmsStatus } from "@/lib/sms/afromessage";
import * as smsData from "@/lib/sms/data";

export const maxDuration = 300;

const BATCH_SIZE = 25; // 25 × ~2.5s ≈ 63s, safely under maxDuration
const STALE_AFTER_MS = 10 * 60 * 1000; // only reconcile messages last polled >10min ago (or never)

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await smsData.listMessagesDueForReconciliation(STALE_AFTER_MS, BATCH_SIZE);

  const results: { id: string; ok: boolean }[] = [];
  for (const message of messages) {
    if (!message.providerMessageId) continue;

    const status = await getSmsStatus(message.providerMessageId);
    if (status.ok) {
      await smsData.upsertMessageStatus({
        providerMessageId: message.providerMessageId,
        statusRaw: status.data.status,
        description: status.data.description,
        parts: Number(status.data.parts) || undefined,
        cost: Number(status.data.cost) || undefined,
        source: "poll",
      });
      results.push({ id: message.$id, ok: true });
    } else {
      results.push({ id: message.$id, ok: false });
    }

    // Serialized ≥2s spacing — the hard rate-limit constraint.
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return NextResponse.json({ processed: results.length, results });
}
