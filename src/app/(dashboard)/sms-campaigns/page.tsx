import { COLLECTIONS, DB, Query, db, type SmsCampaign, type SmsSequence } from "@/lib/appwrite";
import { SmsCampaignControls, SmsCampaignForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function SmsCampaignsPage() {
  const [campaignsRes, sequencesRes] = await Promise.all([
    db().listDocuments(DB(), COLLECTIONS.smsCampaigns, [Query.limit(100), Query.orderDesc("$createdAt")]),
    db().listDocuments(DB(), COLLECTIONS.smsSequences, [Query.limit(100)]),
  ]);
  const campaigns = campaignsRes.documents as unknown as SmsCampaign[];
  const sequences = sequencesRes.documents as unknown as SmsSequence[];
  const seqName = (id: string) => sequences.find((s) => s.$id === id)?.name ?? "—";
  const today = new Date().toISOString().slice(0, 10);
  const sentLabel = (c: SmsCampaign) =>
    !c.sentTodayDate
      ? "sent"
      : c.sentTodayDate === today
        ? "sent today"
        : `sent on ${c.sentTodayDate}`;

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">SMS Campaigns</h1>
      <div className="mb-8">
        <SmsCampaignForm sequences={sequences.map((s) => ({ id: s.$id, name: s.name }))} />
      </div>
      <div className="space-y-4">
        {campaigns.map((c) => (
          <div key={c.$id} className="rounded-lg border border-charcoal/10 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{c.name}</h2>
                <p className="mt-1 text-sm text-smoke">
                  sequence: {seqName(c.sequenceId)} · {c.sentToday}/{c.dailyLimit} {sentLabel(c)} ·
                  sender: {c.senderName || "default"}
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
            <SmsCampaignControls id={c.$id} status={c.status} senderName={c.senderName} />
          </div>
        ))}
        {campaigns.length === 0 && (
          <p className="text-smoke/70">No SMS campaigns yet — create an SMS sequence first, then a campaign.</p>
        )}
      </div>
    </div>
  );
}
