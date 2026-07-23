export const NAV = [
  { href: "/", label: "Overview", code: "01" },
  { href: "/contacts", label: "Contacts", code: "02" },
  { href: "/campaigns", label: "Campaigns", code: "03" },
  { href: "/sequences", label: "Sequences", code: "04" },
  { href: "/inbox", label: "Inbox", code: "05" },
  { href: "/warmup", label: "Warm-up", code: "06" },
  { href: "/send", label: "Send email", code: "07" },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
