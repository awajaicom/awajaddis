/**
 * SMS is billed in parts. GSM-7 (basic Latin + a documented extension
 * table) fits 160 chars in a single part / 153 per part when concatenated
 * across multiple parts. Anything outside that set — including Amharic
 * (Ethiopic block) — falls back to UCS-2: 70 chars single part / 67 per
 * part (7-byte user-data-header overhead when concatenated).
 */

// GSM 03.38 basic character set (7-bit default alphabet).
const GSM_7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

// GSM 03.38 extension table — each of these costs 2 characters (escape + code).
const GSM_7_EXTENSION = "^{}\\[~]|€\f";

const GSM_7_BASIC_SET = new Set(GSM_7_BASIC);
const GSM_7_EXTENSION_SET = new Set(GSM_7_EXTENSION);

export function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM_7_BASIC_SET.has(ch) && !GSM_7_EXTENSION_SET.has(ch)) return false;
  }
  return true;
}

export interface SegmentInfo {
  encoding: "GSM-7" | "UCS-2";
  /** Character count (extension-table chars count once here; billed length differs, see gsm7Length). */
  length: number;
  charsPerPart: number;
  parts: number;
}

export function analyzeSegments(text: string): SegmentInfo {
  const gsm7 = isGsm7(text);
  const length = text.length;

  if (gsm7) {
    // Extension-table characters bill as 2 chars each.
    let billedLength = 0;
    for (const ch of text) billedLength += GSM_7_EXTENSION_SET.has(ch) ? 2 : 1;
    const singlePart = 160;
    const multiPart = 153;
    const parts =
      billedLength <= singlePart ? (billedLength === 0 ? 0 : 1) : Math.ceil(billedLength / multiPart);
    return { encoding: "GSM-7", length: billedLength, charsPerPart: parts > 1 ? multiPart : singlePart, parts };
  }

  const singlePart = 70;
  const multiPart = 67;
  const parts = length <= singlePart ? (length === 0 ? 0 : 1) : Math.ceil(length / multiPart);
  return { encoding: "UCS-2", length, charsPerPart: parts > 1 ? multiPart : singlePart, parts };
}
