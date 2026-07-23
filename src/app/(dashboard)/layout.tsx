import Image from "next/image";
import { MobileNav } from "@/components/mobile-nav";
import { Sidebar } from "@/components/Sidebar";

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

      <Sidebar />

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
