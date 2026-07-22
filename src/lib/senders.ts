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
  { email: "aman@awajet.com", name: "Amanuel Awaj" },
  { email: "kal@awajet.com", name: "Kalkidan Awaj" },
  { email: "sof@awajet.com", name: "Sofonias Awaj" },
  { email: "ibsa@awajet.com", name: "Ibsa from Awaj ET" },
  { email: "info@awajet.com", name: "Awaj ET" },
  { email: "hello@awajet.com", name: "Awaj ET" },
  { email: "support@awajet.com", name: "Awaj ET Support" },
  { email: "sales@awajet.com", name: "Awaj ET Sales" },
  { email: "no-reply@awajet.com", name: "Awaj ET" },
];

export const DEFAULT_SENDER = SENDERS[0].email;

export function getSender(email: string): Sender | undefined {
  return SENDERS.find((s) => s.email === email.toLowerCase().trim());
}

/** RFC 5322 formatted address: `Name <email>` */
export function senderAddress(s: Sender): string {
  return `${s.name} <${s.email}>`;
}
