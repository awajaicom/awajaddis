"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select } from "@/components/ui/select";

interface TemplateOption {
  key: string;
  defaultSubject: string;
  category: string;
  description: string;
}

interface StepDraft {
  templateKey: string;
  subject: string;
  delayDays: number;
}

const inputCls =
  "rounded-md border border-charcoal/20 px-3 py-2 text-sm focus:border-gold focus:outline-none";
const btnCls =
  "rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-amber disabled:opacity-50";

export function SequenceBuilder({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [busy, setBusy] = useState(false);

  function addStep() {
    const t = templates[0];
    setSteps([...steps, { templateKey: t.key, subject: t.defaultSubject, delayDays: steps.length === 0 ? 0 : 3 }]);
  }

  function update(i: number, patch: Partial<StepDraft>) {
    setSteps(steps.map((s, ix) => (ix === i ? { ...s, ...patch } : s)));
  }

  async function save() {
    setBusy(true);
    await fetch("/api/sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        steps: steps.map((s) => ({
          templateKey: s.templateKey,
          subject: s.subject,
          delayHours: s.delayDays * 24,
        })),
      }),
    });
    setBusy(false);
    setName("");
    setSteps([]);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5">
      <h2 className="mb-3 font-semibold">New sequence</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Sequence name (e.g. Cold outreach — retail SMEs)"
        className={`${inputCls} mb-3 w-full`}
      />
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-smoke/70">#{i + 1}</span>
            <div className="w-full sm:w-56">
              <Select
                value={s.templateKey}
                onValueChange={(v) => {
                  const t = templates.find((t) => t.key === v)!;
                  update(i, { templateKey: t.key, subject: t.defaultSubject });
                }}
                options={templates.map((t) => ({ value: t.key, label: `${t.key} (${t.category})` }))}
              />
            </div>
            <input
              value={s.subject}
              onChange={(e) => update(i, { subject: e.target.value })}
              className={`${inputCls} w-full flex-1 sm:min-w-48`}
              placeholder="Subject ({{firstName}}, {{company}} supported)"
            />
            <label className="flex items-center gap-1 text-sm text-smoke">
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
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={addStep} className="rounded-md border border-charcoal/20 px-3 py-1.5 text-sm hover:bg-mist">
          + Add step
        </button>
        <button onClick={save} disabled={busy || !name || steps.length === 0} className={btnCls}>
          Save sequence
        </button>
      </div>
    </div>
  );
}
