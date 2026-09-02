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

export function SmsCampaignForm({ sequences }: { sequences: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [sequenceId, setSequenceId] = useState("");
  const [dailyLimit, setDailyLimit] = useState(50);
  const [senderName, setSenderName] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !sequenceId) return;
    setBusy(true);
    await fetch("/api/sms-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sequenceId, dailyLimit, senderName }),
    });
    setBusy(false);
    setName("");
    setSequenceId("");
    setSenderName("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-charcoal/10 bg-white p-4 sm:p-5">
      <h2 className="mb-3 font-semibold">New SMS campaign</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name *"
          required
          className={inputCls}
        />
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
        <input
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="Sender name (default: account default)"
          className={inputCls}
        />
      </div>
      <button disabled={busy || !name || !sequenceId} className={`${btnCls} mt-3 w-full sm:w-auto`}>
        Create
      </button>
    </form>
  );
}

export function SmsCampaignControls({
  id,
  status,
  senderName,
}: {
  id: string;
  status: string;
  senderName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [tag, setTag] = useState("");
  const [sender, setSender] = useState(senderName);
  const [msg, setMsg] = useState("");

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch("/api/sms-campaigns", {
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

  async function remove() {
    if (!window.confirm("Delete this SMS campaign and its enrollments? Message history is kept.")) return;
    setBusy(true);
    await fetch("/api/sms-campaigns", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
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
        value={sender}
        onChange={(e) => setSender(e.target.value)}
        placeholder="Sender name"
        className="min-h-9 w-full rounded-md border border-charcoal/20 px-3 py-1.5 text-sm focus:border-gold focus:outline-none sm:w-40"
      />
      <button
        disabled={busy || sender === senderName}
        onClick={() => patch({ senderName: sender })}
        className={btnGhost}
      >
        Save sender
      </button>
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
      <button
        disabled={busy}
        onClick={remove}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>
      {msg && <span className="text-sm text-smoke">{msg}</span>}
    </div>
  );
}
