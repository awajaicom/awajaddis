import { NextRequest, NextResponse } from "next/server";
import { advanceWarmupDay, getWarmupState } from "@/lib/warmup";
import { env } from "@/lib/env";

/** Vercel Cron: daily. Advances the warm-up ramp to the next day's volume. */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = await advanceWarmupDay();
  return NextResponse.json({ state: state ?? (await getWarmupState()) });
}
