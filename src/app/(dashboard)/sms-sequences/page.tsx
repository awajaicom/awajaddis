import { COLLECTIONS, DB, Query, db, type SmsSequence, type SmsSequenceStep } from "@/lib/appwrite";
import { SmsSequenceBuilder, SmsSequenceControls } from "./ui";

export const dynamic = "force-dynamic";

export default async function SmsSequencesPage() {
  const [seqRes, stepRes] = await Promise.all([
    db().listDocuments(DB(), COLLECTIONS.smsSequences, [Query.limit(100), Query.orderDesc("$createdAt")]),
    db().listDocuments(DB(), COLLECTIONS.smsSequenceSteps, [Query.limit(500), Query.orderAsc("order")]),
  ]);
  const sequences = seqRes.documents as unknown as SmsSequence[];
  const steps = stepRes.documents as unknown as SmsSequenceStep[];

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">SMS Sequences</h1>
      <div className="mb-8">
        <SmsSequenceBuilder />
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
                  <li key={s.$id} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-amber">
                      {s.order + 1}
                    </span>
                    <span className="flex-1 text-smoke">“{s.bodyTemplate}”</span>
                    <span className="shrink-0 text-smoke/70">
                      {s.order === 0 ? "immediately" : `+${Math.round(s.delayHours / 24)}d`}
                    </span>
                  </li>
                ))}
            </ol>
            <SmsSequenceControls id={seq.$id} />
          </div>
        ))}
        {sequences.length === 0 && <p className="text-smoke/70">No SMS sequences yet — build one above.</p>}
      </div>
    </div>
  );
}
