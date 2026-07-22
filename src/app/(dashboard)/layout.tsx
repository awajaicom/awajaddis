import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav } from "@/components/mobile-nav";
import { NAV_ITEMS } from "@/components/nav-items";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-3 md:hidden">
        <MobileNav />
        <span className="flex items-center gap-2.5 font-display text-lg font-semibold text-white">
          <Image src="/logo.svg" alt="Awaj ET" width={26} height={26} priority />
          Awaj <span className="text-gold">Email</span>
        </span>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 bg-navy p-4 md:block">
        <div className="mb-8 flex items-center gap-2.5 px-2 pt-2">
          <Image src="/logo.svg" alt="Awaj ET" width={30} height={30} priority />
          <span className="font-display text-lg font-semibold text-white">
            Awaj <span className="text-gold">Email</span>
          </span>
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-mist/70 hover:bg-white/5 hover:text-gold"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-10 space-y-2">
          <LogoutButton />
          <p className="px-3 font-mono text-[10px] tracking-widest text-mist/30">
            Max 50 Emails/Day
          </p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
