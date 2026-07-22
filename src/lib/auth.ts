/**
 * Minimal shared-password auth with an HMAC-signed, expiring cookie.
 * Edge-compatible (Web Crypto only) so it runs in Next.js middleware.
 * No database, no library, no per-user accounts.
 */

export const SESSION_COOKIE = "awaj_auth";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const encoder = new TextEncoder();

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Token format: "<expiryEpochMs>.<hmac(expiry, secret)>" */
export async function createSessionToken(secret: string): Promise<string> {
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${await hmacHex(exp, secret)}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = await hmacHex(exp, secret);
  return timingSafeEqual(sig, expected);
}

/**
 * Constant-time password check: compare HMACs of both values instead of the
 * raw strings, so length and content leak nothing via timing.
 */
export async function verifyPassword(submitted: string, actual: string, secret: string): Promise<boolean> {
  const [a, b] = await Promise.all([hmacHex(submitted, secret), hmacHex(actual, secret)]);
  return timingSafeEqual(a, b);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
