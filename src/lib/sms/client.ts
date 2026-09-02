/**
 * Low-level AfroMessage HTTP client. Every AfroMessage response shares the
 * same two-node envelope — HTTP 200 does NOT mean success, the caller must
 * branch on `acknowledge === "success"`.
 *
 * Safety notes (do not weaken these):
 * - Never log `init`, headers, or the constructed Authorization header —
 *   the token must never appear in logs.
 * - Always `cache: "no-store"` — Next.js caches fetch by default and would
 *   happily serve a stale balance or, worse, dedupe a send.
 * - Callers must never blindly retry a timed-out send — a timeout does not
 *   mean the message wasn't sent. Surface it as a failure/pending state and
 *   let reconciliation resolve it; do not auto-retry here.
 */

export type AfroEnvelope<T> = {
  acknowledge: "success" | string;
  response: T | { errors?: unknown; message?: string };
};

export type AfroResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; httpStatus: number; raw: unknown };

function base(): string {
  return process.env.AFROMESSAGE_BASE_URL || "https://api.afromessage.com";
}

export async function afroFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; query?: Record<string, string> }
): Promise<AfroResult<T>> {
  // Read directly from process.env (not lib/env.ts's throwing accessors) so
  // a missing token degrades gracefully instead of throwing — callers with
  // SMS_ENABLED=false must keep working even before a token is configured.
  const token = process.env.AFROMESSAGE_TOKEN;
  if (!token) {
    return {
      ok: false,
      code: "CONFIG",
      message: "AFROMESSAGE_TOKEN is not set",
      httpStatus: 0,
      raw: null,
    };
  }

  const url = new URL(path, base());
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    // Read as text first — the provider can return non-JSON on gateway
    // errors, and res.json() would throw an opaque error in that case.
    const text = await res.text();
    let json: AfroEnvelope<T>;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        code: "BAD_RESPONSE",
        message: text.slice(0, 500),
        httpStatus: res.status,
        raw: text,
      };
    }

    if (res.status === 429) {
      return {
        ok: false,
        code: "RATE_LIMITED",
        message: "AfroMessage rate limit hit",
        httpStatus: 429,
        raw: json,
      };
    }
    if (json.acknowledge !== "success") {
      return {
        ok: false,
        code: "PROVIDER_ERROR",
        message: JSON.stringify(json.response),
        httpStatus: res.status,
        raw: json,
      };
    }
    return { ok: true, data: json.response as T };
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return {
      ok: false,
      code: aborted ? "TIMEOUT" : "NETWORK",
      message: (e as Error).message,
      httpStatus: 0,
      raw: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
