/**
 * Ethiopian phone normalization → E.164. Recipients arrive in many shapes
 * (0911234567, 911234567, +251911234567, 251911234567, with spaces/dashes)
 * — normalize before sending, reject anything that doesn't resolve rather
 * than guessing.
 */

const MOBILE_RE = /^\+251[79]\d{8}$/;

/** Returns the E.164 form, or null if the input can't be resolved to a valid Ethiopian mobile number. */
export function normalizePhone(raw: string): string | null {
  const stripped = raw.replace(/[\s\-()]/g, "");
  if (!stripped) return null;

  let candidate: string;
  if (stripped.startsWith("+251")) {
    candidate = stripped;
  } else if (stripped.startsWith("251")) {
    candidate = `+${stripped}`;
  } else if (/^0\d{9}$/.test(stripped)) {
    candidate = `+251${stripped.slice(1)}`;
  } else if (/^[79]\d{8}$/.test(stripped)) {
    candidate = `+251${stripped}`;
  } else {
    candidate = stripped;
  }

  return MOBILE_RE.test(candidate) ? candidate : null;
}

/** Normalizes every input, deduping valid numbers; invalid entries keep their original raw string so a UI can report which row failed. */
export function normalizeAndDedupe(rawPhones: string[]): {
  valid: string[];
  invalid: string[];
} {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const raw of rawPhones) {
    const normalized = normalizePhone(raw);
    if (!normalized) {
      invalid.push(raw);
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    valid.push(normalized);
  }

  return { valid, invalid };
}
