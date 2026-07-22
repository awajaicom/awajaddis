"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WarmupControls({ status }: { status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: string) {
    setBusy(true);
    await fetch("/api/warmup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    router.refresh();
  }

  const btn = "rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50";
  if (status === "none") {
    return (
      <button disabled={busy} onClick={() => act("start")} className={`${btn} bg-gold text-navy hover:bg-amber w-48`}>
        Start warm-up
      </button>
    );
  }
  if (status === "active") {
    return (
      <button disabled={busy} onClick={() => act("pause")} className={`${btn} border border-charcoal/20 hover:bg-mist`}>
        Pause
      </button>
    );
  }
  if (status === "paused") {
    return (
      <button disabled={busy} onClick={() => act("resume")} className={`${btn} bg-gold text-navy hover:bg-amber`}>
        Resume
      </button>
    );
  }
  return null;
}
