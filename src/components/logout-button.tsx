"use client";

export function LogoutButton({ className = "" }: { className?: string }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button
      onClick={logout}
      className={`font-mono text-[10px] tracking-[0.14em] text-white/40 uppercase transition-colors hover:text-amber ${className}`}
    >
     🔒Sign out
    </button>
  );
}
