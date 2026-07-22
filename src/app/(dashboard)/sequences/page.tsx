import { COLLECTIONS, DB, Query, db, type Sequence, type SequenceStep } from "@/lib/appwrite";
import { TEMPLATES } from "@/emails/registry";
import { SequenceBuilder } from "./ui";

export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  const [seqRes, stepRes] = await Promise.all([
    db().listDocuments(DB(), COLLECTIONS.sequences, [Query.limit(100), Query.orderDesc("$createdAt")]),
    db().listDocuments(DB(), COLLECTIONS.sequenceSteps, [Query.limit(500), Query.orderAsc("order")]),
  ]);
  const sequences = seqRes.documents as unknown as Sequence[];
  const steps = stepRes.documents as unknown as SequenceStep[];
  const templates = Object.entries(TEMPLATES).map(([key, t]) => ({
    key,
    defaultSubject: t.defaultSubject,
    category: t.category,
    description: t.description,
  }));

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Sequences</h1>
      <div className="mb-8">
        <SequenceBuilder templates={templates} />
      </div>
      <div className="space-y-4">
        {sequences.map((seq) => (
          <div key={seq.$id} className="rounded-lg border border-charcoal/10 bg-white p-5">
            <h2 className="font-semibold">{seq.name}</h2>
            {seq.description && <p className="mt-1 text-sm text-smoke">{seq.description}</p>}
            <ol className="mt-3 space-y-2">
              {steps
                .filter((s) => s.sequenceId === seq.$id)
                .map((s) => (
                  <li key={s.$id} className="flex items-center gap-3 text-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-amber">
                      {s.order + 1}
                    </span>
                    <span className="font-medium">{s.templateKey}</span>
                    <span className="text-smoke">“{s.subject}”</span>
                    <span className="ml-auto text-smoke/70">
                      {s.order === 0 ? "immediately" : `+${Math.round(s.delayHours / 24)}d`}
                    </span>
                  </li>
                ))}
            </ol>
          </div>
        ))}
        {sequences.length === 0 && <p className="text-smoke/70">No sequences yet — build one above.</p>}
      </div>
    </div>
  );
}
