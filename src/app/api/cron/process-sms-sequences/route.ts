import { NextRequest, NextResponse } from "next/server";
import { processDueSmsEnrollments } from "@/lib/sms-sequence-engine";
import { env } from "@/lib/env";

export const maxDuration = 300;

/** Triggered by .github/workflows/cron.yml every 15 min. Sends due SMS sequence steps within limits. */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await processDueSmsEnrollments();
  return NextResponse.json(result);
}
