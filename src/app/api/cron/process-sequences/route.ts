import { NextRequest, NextResponse } from "next/server";
import { processDueEnrollments } from "@/lib/sequence-engine";
import { env } from "@/lib/env";

export const maxDuration = 300;

/** Vercel Cron: every 15 min. Sends due sequence steps within limits. */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await processDueEnrollments();
  return NextResponse.json(result);
}
