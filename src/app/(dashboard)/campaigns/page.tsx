import { COLLECTIONS, DB, Query, db, type Campaign, type Sequence } from "@/lib/appwrite";
import { CampaignControls, CampaignForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const [campaignsRes, sequencesRes] = await Promise.all([
    db().listDocuments(DB(), COLLECTIONS.campaigns, [Query.limit(100), Query.orderDesc("$createdAt")]),
    db().listDocuments(DB(), COLLECTIONS.sequences, [Query.limit(100)]),
  ]);
  const campaigns = campaignsRes.documents as unknown as Campaign[];
  const sequences = sequencesRes.documents as unknown as Sequence[];
  const seqName = (id: string) => sequences.find((s) => s.$id === id)?.name ?? "—";

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Campaigns</h1>
      <div className="mb-8">
        <CampaignForm sequences={sequences.map((s) => ({ id: s.$id, name: s.name }))} />
      </div>
      <div className="space-y-4">
        {campaigns.map((c) => (
          <div key={c.$id} className="rounded-lg border border-charcoal/10 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{c.name}</h2>
                <p className="mt-1 text-sm text-smoke">
                  {c.type} · sequence: {seqName(c.sequenceId)} · {c.sentToday}/{c.dailyLimit} sent today
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  c.status === "active"
                    ? "bg-gold/15 text-amber"
                    : c.status === "paused"
                      ? "bg-amber/15 text-amber"
                      : "bg-charcoal/10 text-smoke"
                }`}
              >
                {c.status}
              </span>
            </div>
            <CampaignControls id={c.$id} status={c.status} />
          </div>
        ))}
        {campaigns.length === 0 && (
          <p className="text-smoke/70">No campaigns yet — create a sequence first, then a campaign.</p>
        )}
      </div>
    </div>
  );
}
