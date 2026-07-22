"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select } from "@/components/ui/select";

const inputCls =
  "w-full min-h-10 rounded-md border border-charcoal/20 px-3 py-2 text-sm focus:border-gold focus:outline-none";
const btnCls =
  "rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-amber disabled:opacity-50";
const btnGhost =
  "rounded-md border border-charcoal/20 px-3 py-1.5 text-sm text-charcoal hover:bg-mist disabled:opacity-50";

const TYPE_OPTIONS = [
  { value: "cold", label: "Cold outreach" },
  { value: "lead_magnet", label: "Lead magnet" },
  { value: "nurture", label: "Nurture" },
];

export function CampaignForm({ sequences }: { sequences: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("cold");
  const [sequenceId, setSequenceId] = useState("");
  const [dailyLimit, setDailyLimit] = useState(50);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !sequenceId) return;
    setBusy(true);
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, sequenceId, dailyLimit }),
    });
    setBusy(false);
    setName("");
    setSequenceId("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-charcoal/10 bg-white p-4 sm:p-5">
      <h2 className="mb-3 font-semibold">New campaign</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name *"
          required
          className={inputCls}
        />
        <Select value={type} onValueChange={setType} options={TYPE_OPTIONS} />
        <Select
          value={sequenceId}
          onValueChange={setSequenceId}
          placeholder="Sequence… *"
          options={sequences.map((s) => ({ value: s.id, label: s.name }))}
        />
        <input
          type="number"
          value={dailyLimit}
          onChange={(e) => setDailyLimit(Number(e.target.value))}
          min={1}
          className={inputCls}
          aria-label="Daily limit"
        />
      </div>
      <button disabled={busy || !name || !sequenceId} className={`${btnCls} mt-3 w-full sm:w-auto`}>
        Create
      </button>
    </form>
  );
}

export function CampaignControls({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [tag, setTag] = useState("");
  const [msg, setMsg] = useState("");

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch("/api/campaigns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    const data = await res.json();
    if (typeof data.enrolled === "number" && payload.enroll) {
      setMsg(`Enrolled ${data.enrolled} contact(s).`);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {status !== "active" && (
        <button disabled={busy} onClick={() => patch({ status: "active" })} className={btnGhost}>
          Activate
        </button>
      )}
      {status === "active" && (
        <button disabled={busy} onClick={() => patch({ status: "paused" })} className={btnGhost}>
          Pause
        </button>
      )}
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="Enroll contacts by tag…"
        className="min-h-9 w-full rounded-md border border-charcoal/20 px-3 py-1.5 text-sm focus:border-gold focus:outline-none sm:w-auto"
      />
      <button
        disabled={busy || !tag}
        onClick={() => patch({ enroll: { tag } })}
        className={btnGhost}
      >
        Enroll
      </button>
      {msg && <span className="text-sm text-smoke">{msg}</span>}
    </div>
  );
}
