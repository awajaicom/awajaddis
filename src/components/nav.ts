export const NAV = [
  { href: "/", label: "Overview", code: "01" },
  { href: "/contacts", label: "Contacts", code: "02" },
  { href: "/campaigns", label: "Campaigns", code: "03" },
  { href: "/sequences", label: "Sequences", code: "04" },
  { href: "/inbox", label: "Inbox", code: "05" },
  { href: "/send", label: "Send email", code: "06" },
  { href: "/sms-campaigns", label: "SMS Campaigns", code: "07" },
  { href: "/sms-sequences", label: "SMS Sequences", code: "08" },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
