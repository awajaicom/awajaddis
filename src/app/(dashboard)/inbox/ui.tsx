"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InboundEmail } from "@/lib/appwrite";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function InboxList({ emails }: { emails: InboundEmail[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboundEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState<Record<string, "read" | "unread">>({});

  async function open(email: InboundEmail) {
    setSelectedId(email.$id);
    setLoading(true);
    setDetail(null);
    const res = await fetch(`/api/inbox/${email.$id}`);
    const data = await res.json();
    setDetail(data);
    setLoading(false);
    if (email.status === "unread") {
      setLocalStatus((s) => ({ ...s, [email.$id]: "read" }));
      await fetch(`/api/inbox/${email.$id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "read" }),
      });
      router.refresh();
    }
  }

  if (emails.length === 0) {
    return (
      <div className="rounded-lg border border-charcoal/10 bg-white p-8 text-center text-smoke/70">
        No emails yet. Replies sent to your domain will show up here.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="overflow-hidden rounded-lg border border-charcoal/10 bg-white">
        <ul className="max-h-[70vh] divide-y divide-charcoal/5 overflow-y-auto">
          {emails.map((e) => {
            const status = localStatus[e.$id] ?? e.status;
            const active = selectedId === e.$id;
            return (
              <li key={e.$id}>
                <button
                  onClick={() => open(e)}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-mist ${
                    active ? "bg-mist" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={status === "unread" ? "font-semibold" : "text-charcoal"}>
                      {e.from}
                    </span>
                    <span className="shrink-0 text-xs text-smoke">{timeAgo(e.receivedAt)}</span>
                  </div>
                  <div className={`mt-0.5 truncate ${status === "unread" ? "font-medium" : "text-smoke"}`}>
                    {e.subject || "(no subject)"}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-lg border border-charcoal/10 bg-white p-5">
        {!selectedId && (
          <p className="text-sm text-smoke/70">Select an email to read it.</p>
        )}
        {selectedId && loading && <p className="text-sm text-smoke/70">Loading…</p>}
        {selectedId && detail && !loading && (
          <div>
            <h2 className="font-display text-lg font-semibold">{detail.subject || "(no subject)"}</h2>
            <p className="mt-1 text-sm text-smoke">
              From <span className="text-charcoal">{detail.from}</span> to {detail.to}
            </p>
            <p className="mb-4 text-xs text-smoke/70">{new Date(detail.receivedAt).toLocaleString()}</p>
            {detail.html ? (
              <iframe
                title="Email content"
                srcDoc={detail.html}
                sandbox=""
                className="h-[60vh] w-full border-0 border-t border-charcoal/10 pt-4"
              />
            ) : (
              <pre className="whitespace-pre-wrap border-t border-charcoal/10 pt-4 text-sm">
                {detail.text || "(empty message)"}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
