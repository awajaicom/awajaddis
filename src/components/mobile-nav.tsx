"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { LogoutButton } from "./logout-button";
import { NAV_ITEMS } from "./nav-items";

/** Hamburger + slide-in drawer, shown on small screens only. */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          aria-label="Open navigation"
          className="rounded-md p-2 text-mist/80 hover:bg-white/10 hover:text-gold"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm data-[state=open]:animate-in" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 w-64 bg-navy p-4 shadow-xl focus:outline-none"
          aria-describedby={undefined}
        >
          <div className="mb-6 flex items-center justify-between px-2 pt-2">
            <Dialog.Title asChild>
              <span className="flex items-center gap-2.5 font-display text-lg font-semibold text-white">
                <Image src="/logo.svg" alt="Awaj ET" width={26} height={26} />
                Awaj <span className="text-gold">Email</span>
              </span>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close navigation" className="rounded-md p-2 text-mist/70 hover:bg-white/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </Dialog.Close>
          </div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-mist/70 hover:bg-white/5 hover:text-gold"
              >
                {item.label}
              </Link>
            ))}
            <LogoutButton className="mt-4" />
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
