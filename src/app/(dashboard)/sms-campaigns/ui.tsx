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

interface EnrolledContact {
  $id: string;
  currentStep: number;
  status: string;
  nextSendAt: string;
  contact: { firstName: string; lastName?: string; phone?: string } | null;
}

/**
 * Per-campaign enrollment list, collapsed by default (lazy-fetched on
 * expand). Stop/Resume act on ONE enrollment in THIS campaign only — never
 * the global suppression list, unlike SmsOptOutButton on the Contacts page.
 */
export function EnrolledContacts({ campaignId, count }: { campaignId: string; count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EnrolledContact[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/sms-enrollments?campaignId=${campaignId}`);
    const data = await res.json();
    setRows(data.enrollments ?? []);
    setLoading(false);
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !rows) await load();
  }

  async function setStatus(id: string, status: "active" | "stopped", name: string) {
    const confirmMsg =
      status === "stopped"
        ? `Stop ${name}'s remaining messages in this campaign? Their other campaigns and global SMS opt-in are unaffected.`
        : `Resume ${name} in this campaign?`;
    if (!window.confirm(confirmMsg)) return;
    setBusyId(id);
    const res = await fetch("/api/sms-enrollments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "Failed to update enrollment.");
      return;
    }
    await load();
    router.refresh();
  }

  return (
    <div className="mt-3">
      <button onClick={toggle} className="text-xs text-smoke hover:underline">
        {open ? "Hide" : "Show"} enrolled contacts ({count})
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto rounded-md border border-charcoal/10">
          <table className="w-full min-w-[520px] text-xs">
            <thead className="bg-mist text-left text-smoke">
              <tr>
                <th className="px-3 py-1.5 font-medium">Contact</th>
                <th className="px-3 py-1.5 font-medium">Phone</th>
                <th className="px-3 py-1.5 font-medium">Step</th>
                <th className="px-3 py-1.5 font-medium">Status</th>
                <th className="px-3 py-1.5 font-medium">Next send</th>
                <th className="px-3 py-1.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-3 py-3 text-center text-smoke/70">Loading…</td></tr>
              )}
              {!loading && rows?.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-3 text-center text-smoke/70">No one enrolled yet.</td></tr>
              )}
              {!loading &&
                rows?.map((r) => (
                  <tr key={r.$id} className="border-t border-charcoal/5">
                    <td className="px-3 py-1.5">
                      {r.contact ? [r.contact.firstName, r.contact.lastName].filter(Boolean).join(" ") : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-smoke">{r.contact?.phone ?? "—"}</td>
                    <td className="px-3 py-1.5 text-smoke">{r.currentStep + 1}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.status === "active"
                            ? "bg-gold/15 text-amber"
                            : "bg-charcoal/10 text-smoke"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-smoke">
                      {r.status === "active" ? new Date(r.nextSendAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.status === "active" && (
                        <button
                          disabled={busyId === r.$id}
                          onClick={() => setStatus(r.$id, "stopped", r.contact?.firstName || "this contact")}
                          className="text-red-500 hover:underline disabled:opacity-50"
                        >
                          Stop
                        </button>
                      )}
                      {r.status === "stopped" && (
                        <button
                          disabled={busyId === r.$id}
                          onClick={() => setStatus(r.$id, "active", r.contact?.firstName || "this contact")}
                          className="text-charcoal hover:underline disabled:opacity-50"
                        >
                          Resume
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
