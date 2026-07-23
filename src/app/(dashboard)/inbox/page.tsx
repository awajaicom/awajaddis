import { COLLECTIONS, DB, Query, db, type InboundEmail } from "@/lib/appwrite";
import { InboxList } from "./ui";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const res = await db().listDocuments(DB(), COLLECTIONS.inboundEmails, [
    Query.limit(200),
    Query.orderDesc("receivedAt"),
    Query.select(["$id", "$createdAt", "from", "to", "subject", "status", "receivedAt"]),
  ]);
  const emails = res.documents as unknown as InboundEmail[];

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Inbox ({res.total})</h1>
      <InboxList emails={emails} />
    </div>
  );
}
