import { NextRequest, NextResponse } from "next/server";
import { getWarmupState, startWarmup, targetForDay } from "@/lib/warmup";
import { COLLECTIONS, DB, db } from "@/lib/appwrite";
import { env } from "@/lib/env";

export async function GET() {
  const state = await getWarmupState();
  const schedule = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    volume: targetForDay(i + 1),
  })).filter((d, i, arr) => i === 0 || arr[i - 1].volume < env.warmupMaxDaily());
  return NextResponse.json({ state, schedule });
}

/** POST { action: "start" | "pause" | "resume" } */
export async function POST(req: NextRequest) {
  const { action } = await req.json();
  if (action === "start") {
    const state = await startWarmup();
    return NextResponse.json({ state });
  }
  const state = await getWarmupState();
  if (!state) return NextResponse.json({ error: "no warm-up started" }, { status: 400 });
  if (action === "pause" || action === "resume") {
    const doc = await db().updateDocument(DB(), COLLECTIONS.warmup, state.$id, {
      status: action === "pause" ? "paused" : "active",
    });
    return NextResponse.json({ state: doc });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
