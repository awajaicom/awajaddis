"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { analyzeSegments } from "@/lib/sms/segments";

interface StepDraft {
  bodyTemplate: string;
  delayDays: number;
}

const inputCls =
  "rounded-md border border-charcoal/20 px-3 py-2 text-sm focus:border-gold focus:outline-none";
const textareaCls = `${inputCls} w-full resize-y`;
const btnCls =
  "rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-amber disabled:opacity-50";

export function SmsSequenceBuilder() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [busy, setBusy] = useState(false);

  function addStep() {
    setSteps([...steps, { bodyTemplate: "", delayDays: steps.length === 0 ? 0 : 3 }]);
  }

  function update(i: number, patch: Partial<StepDraft>) {
    setSteps(steps.map((s, ix) => (ix === i ? { ...s, ...patch } : s)));
  }

  async function save() {
    setBusy(true);
    await fetch("/api/sms-sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        steps: steps.map((s) => ({
          bodyTemplate: s.bodyTemplate,
          delayHours: s.delayDays * 24,
        })),
      }),
    });
    setBusy(false);
    setName("");
    setSteps([]);
    router.refresh();
  }

  const canSave = name && steps.length > 0 && steps.every((s) => s.bodyTemplate.trim());

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5">
      <h2 className="mb-3 font-semibold">New SMS sequence</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Sequence name (e.g. Cold outreach — retail SMEs)"
        className={`${inputCls} mb-3 w-full`}
      />
      <div className="space-y-3">
        {steps.map((s, i) => {
          const segs = analyzeSegments(s.bodyTemplate);
          return (
            <div key={i} className="rounded-md border border-charcoal/10 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm text-smoke/70">#{i + 1}</span>
                <label className="ml-auto flex items-center gap-1 text-sm text-smoke">
                  wait
                  <input
                    type="number"
                    min={0}
                    value={s.delayDays}
                    onChange={(e) => update(i, { delayDays: Number(e.target.value) })}
                    className={`${inputCls} w-16`}
                    disabled={i === 0}
                  />
                  days
                </label>
                <button
                  onClick={() => setSteps(steps.filter((_, ix) => ix !== i))}
                  className="text-sm text-red-500 hover:underline"
                >
                  remove
                </button>
              </div>
              <textarea
                value={s.bodyTemplate}
                onChange={(e) => update(i, { bodyTemplate: e.target.value })}
                rows={3}
                className={textareaCls}
                placeholder="Message text ({{firstName}}, {{company}} supported)"
              />
              <p className="mt-1 text-xs text-smoke/70">
                {segs.length} chars · {segs.encoding} · {segs.parts || 0} part{segs.parts === 1 ? "" : "s"}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={addStep} className="rounded-md border border-charcoal/20 px-3 py-1.5 text-sm hover:bg-mist">
          + Add step
        </button>
        <button onClick={save} disabled={busy || !canSave} className={btnCls}>
          Save sequence
        </button>
      </div>
    </div>
  );
}

export function SmsSequenceControls({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm("Delete this SMS sequence and its steps?")) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/sms-sequences", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to delete.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        disabled={busy}
        onClick={remove}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
