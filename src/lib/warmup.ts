import { COLLECTIONS, DB, ID, Query, db, type WarmupState } from "./appwrite";
import { env } from "./env";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Warm-up ramp: start at WARMUP_START_VOLUME sends/day, multiply by
 * WARMUP_GROWTH_RATE daily, cap at WARMUP_MAX_DAILY. Once the cap is
 * reached the warm-up is "completed" and no longer limits sending.
 */
export function targetForDay(day: number): number {
  const start = env.warmupStartVolume();
  const rate = env.warmupGrowthRate();
  const max = env.warmupMaxDaily();
  return Math.min(Math.round(start * Math.pow(rate, day - 1)), max);
}

export async function getWarmupState(): Promise<WarmupState | null> {
  const res = await db().listDocuments(DB(), COLLECTIONS.warmup, [Query.limit(1)]);
  return (res.documents[0] as unknown as WarmupState) ?? null;
}

export async function startWarmup(): Promise<WarmupState> {
  const existing = await getWarmupState();
  if (existing) return existing;
  const doc = await db().createDocument(DB(), COLLECTIONS.warmup, ID.unique(), {
    day: 1,
    targetVolume: targetForDay(1),
    sentToday: 0,
    date: today(),
    status: "active",
    startedAt: new Date().toISOString(),
  });
  return doc as unknown as WarmupState;
}

/** Advance to the next warm-up day (run by the daily cron). */
export async function advanceWarmupDay(): Promise<WarmupState | null> {
  const state = await getWarmupState();
  if (!state || state.status !== "active") return state;
  const nextDay = state.day + 1;
  const target = targetForDay(nextDay);
  const completed = target >= env.warmupMaxDaily();
  const doc = await db().updateDocument(DB(), COLLECTIONS.warmup, state.$id, {
    day: nextDay,
    targetVolume: target,
    sentToday: 0,
    date: today(),
    status: completed ? "completed" : "active",
  });
  return doc as unknown as WarmupState;
}

/**
 * How many cold/outreach emails may still be sent today under the warm-up cap.
 * Returns Infinity when warm-up is not active.
 */
export async function remainingWarmupBudget(): Promise<number> {
  const state = await getWarmupState();
  if (!state || state.status !== "active") return Infinity;
  // Reset counter if the cron hasn't run yet today.
  if (state.date !== today()) {
    await db().updateDocument(DB(), COLLECTIONS.warmup, state.$id, {
      sentToday: 0,
      date: today(),
    });
    return state.targetVolume;
  }
  return Math.max(0, state.targetVolume - state.sentToday);
}

export async function recordWarmupSends(count: number): Promise<void> {
  const state = await getWarmupState();
  if (!state || state.status !== "active") return;
  await db().updateDocument(DB(), COLLECTIONS.warmup, state.$id, {
    sentToday: state.sentToday + count,
    date: today(),
  });
}
