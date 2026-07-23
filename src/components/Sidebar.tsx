"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { isActive, NAV } from "./nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-navy text-white md:flex">
      <div className="px-6 pt-8 pb-6">
        <div className="font-display text-xl font-bold tracking-tight">
          Awaj<span className="text-gold"> Email</span>
        </div>
        <div className="mt-1 font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">
          Outreach Engine
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-white/10 font-semibold text-gold"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="font-mono text-[10px] text-white/30">{item.code}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-6 pb-8">
        <p className="font-mono text-[10px] tracking-widest text-white/30 uppercase">
          Max 50 Emails/Day
        </p>
        <LogoutButton className="mt-5" />
      </div>
    </aside>
  );
}
