"use client";

import { useState } from "react";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = redirectTo;
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Sign-in failed");
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoFocus
        required
        className="min-h-10 w-full rounded-md border border-charcoal/20 px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        disabled={busy || !password}
        className="mt-4 w-full rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-navy hover:bg-amber disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
