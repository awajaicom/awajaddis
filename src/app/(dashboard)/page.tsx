import { COLLECTIONS, DB, Query, db, type Send } from "@/lib/appwrite";
import { getWarmupState } from "@/lib/warmup";

export const dynamic = "force-dynamic";

async function count(collection: string, queries: string[] = []): Promise<number> {
  const res = await db().listDocuments(DB(), collection, [Query.limit(1), ...queries]);
  return res.total;
}

export default async function Overview() {
  const [contacts, activeEnrollments, suppressions, warmup, recentSends] = await Promise.all([
    count(COLLECTIONS.contacts),
    count(COLLECTIONS.enrollments, [Query.equal("status", "active")]),
    count(COLLECTIONS.suppressions),
    getWarmupState(),
    db().listDocuments(DB(), COLLECTIONS.sends, [Query.limit(200), Query.orderDesc("sentAt")]),
  ]);

  const sends = recentSends.documents as unknown as Send[];
  const opened = sends.filter((s) => ["opened", "clicked"].includes(s.status)).length;
  const bounced = sends.filter((s) => s.status === "bounced").length;
  const openRate = sends.length ? Math.round((opened / sends.length) * 100) : 0;
  const bounceRate = sends.length ? Math.round((bounced / sends.length) * 100) : 0;

  const stats = [
    { label: "Contacts", value: contacts },
    { label: "Active sequences", value: activeEnrollments },
    { label: "Open rate (last 200)", value: `${openRate}%` },
    { label: "Bounce rate (last 200)", value: `${bounceRate}%`, alert: bounceRate > 3 },
    { label: "Suppressed", value: suppressions },
    {
      label: "Warm-up",
      value: warmup
        ? warmup.status === "completed"
          ? "Done"
          : `Day ${warmup.day} · ${warmup.sentToday}/${warmup.targetVolume}`
        : "Not started",
    },
  ];

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Overview</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-charcoal/10 bg-white p-5">
            <p className="text-sm text-smoke">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${s.alert ? "text-red-600" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 mb-4 font-display text-lg font-semibold">Recent sends</h2>
      <div className="overflow-x-auto rounded-lg border border-charcoal/10 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-mist text-left text-smoke">
            <tr>
              <th className="px-4 py-2 font-medium">Template</th>
              <th className="px-4 py-2 font-medium">Subject</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Sent</th>
            </tr>
          </thead>
          <tbody>
            {sends.slice(0, 25).map((s) => (
              <tr key={s.$id} className="border-t border-charcoal/5">
                <td className="px-4 py-2">{s.templateKey}</td>
                <td className="px-4 py-2 max-w-xs truncate">{s.subject}</td>
                <td className="px-4 py-2">{s.category}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      ["bounced", "complained"].includes(s.status)
                        ? "bg-red-100 text-red-700"
                        : ["opened", "clicked"].includes(s.status)
                          ? "bg-gold/15 text-amber"
                          : "bg-charcoal/10 text-smoke"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-smoke">{new Date(s.sentAt).toLocaleString()}</td>
              </tr>
            ))}
            {sends.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-smoke/70">No sends yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
