"use client";

export function LogoutButton({ className = "" }: { className?: string }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button
      onClick={logout}
      className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-mist/50 hover:bg-white/5 hover:text-gold ${className}`}
    >
      Sign out
    </button>
  );
}
