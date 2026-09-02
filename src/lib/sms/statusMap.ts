/**
 * AfroMessage doesn't publish a complete status enumeration — only QUEUED
 * (createCallback) and UNDELIV (status response) are confirmed. Do not
 * hard-code an exhaustive enum or throw on unknown values; store the raw
 * provider string and map it through this lookup with a safe default.
 *
 * Note: `SmsMessageState` also has a `queued` value this 3-way classifier
 * doesn't produce — `queued` is set explicitly by the create-callback
 * handler for the `QUEUED` status (a known, non-terminal, provider-specific
 * value distinct from "not yet sent"), not derived from classify().
 */

const TERMINAL_OK = new Set(["DELIVRD", "DELIVERED"]);
const TERMINAL_FAIL = new Set(["UNDELIV", "EXPIRED", "REJECTD", "DELETED", "UNKNOWN"]);

export function classify(raw: string): "pending" | "delivered" | "failed" {
  const s = raw.toUpperCase();
  if (TERMINAL_OK.has(s)) return "delivered";
  if (TERMINAL_FAIL.has(s)) return "failed";
  // Log unknown statuses so the mapping can be corrected against real traffic.
  console.warn(`[sms] unknown provider status: ${raw}`);
  return "pending";
}
