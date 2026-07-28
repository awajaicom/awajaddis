/**
 * Approved sender accounts for manual sends. Client-safe (no secrets).
 * The compose API validates against this list, so arbitrary from-addresses
 * can't be injected even with direct API access. Edit here to add/remove.
 */
export interface Sender {
  email: string;
  name: string;
}

export const SENDERS: Sender[] = [
  { email: "amanuel@awajaddis.com", name: "Amanuel Awaj" },
  { email: "kalkidan@awajaddis.com", name: "Kalkidan Awaj" },
  { email: "sofonias@awajaddis.com", name: "Sofonias Awaj" },
  { email: "natnael@awajaddis.com", name: "Natnael Awaj" },
  { email: "eden@awajaddis.com", name: "Eden Awaj" },
  { email: "ibsa@awajaddis.com", name: "Ibsa Awaj" },
  { email: "info@awajaddis.com", name: "Awaj ET" },
  { email: "hello@awajaddis.com", name: "Awaj ET" },
  { email: "support@awajaddis.com", name: "Awaj ET Support" },
  { email: "sales@awajaddis.com", name: "Awaj ET Sales" },
  { email: "no-reply@awajaddis.com", name: "Awaj ET" },
];

export const DEFAULT_SENDER = SENDERS[0].email;

export function getSender(email: string): Sender | undefined {
  return SENDERS.find((s) => s.email === email.toLowerCase().trim());
}

/** RFC 5322 formatted address: `Name <email>` */
export function senderAddress(s: Sender): string {
  return `${s.name} <${s.email}>`;
}
