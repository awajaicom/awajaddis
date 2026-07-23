"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AttachmentPicker, attachmentsTooBig, uploadToAppwrite } from "@/components/attachment-picker";
import type { InboundEmail } from "@/lib/appwrite";
import type { ThreadMessage } from "@/app/api/inbox/thread/route";

const btnCls =
  "rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-amber disabled:opacity-50";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface Conversation {
  counterparty: string;
  latest: InboundEmail;
  messages: InboundEmail[];
  unreadCount: number;
}

export function InboxList({ emails }: { emails: InboundEmail[] }) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState<Record<string, "read" | "unread">>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[] | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyAttachmentsKey, setReplyAttachmentsKey] = useState(0);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyMsg, setReplyMsg] = useState("");

  const conversations = useMemo<Conversation[]>(() => {
    const byCounterparty = new Map<string, InboundEmail[]>();
    for (const e of emails) {
      const key = e.from.toLowerCase();
      if (!byCounterparty.has(key)) byCounterparty.set(key, []);
      byCounterparty.get(key)!.push(e);
    }
    const convos = Array.from(byCounterparty.entries()).map(([counterparty, msgs]) => {
      const sorted = [...msgs].sort(
        (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
      );
      const unreadCount = sorted.filter((m) => (localStatus[m.$id] ?? m.status) === "unread").length;
      return { counterparty, latest: sorted[0], messages: sorted, unreadCount };
    });
    convos.sort(
      (a, b) => new Date(b.latest.receivedAt).getTime() - new Date(a.latest.receivedAt).getTime()
    );
    return convos;
  }, [emails, localStatus]);

  async function loadThread(counterparty: string) {
    setThreadLoading(true);
    setThread(null);
    const res = await fetch(`/api/inbox/thread?email=${encodeURIComponent(counterparty)}`);
    const data = await res.json();
    setThread(data.messages ?? []);
    setThreadLoading(false);
  }

  async function open(convo: Conversation) {
    setSelected(convo.counterparty);
    setReplyText("");
    setReplyMsg("");
    setReplyFiles([]);
    setReplyAttachmentsKey((k) => k + 1);
    await loadThread(convo.counterparty);

    const unread = convo.messages.filter((m) => (localStatus[m.$id] ?? m.status) === "unread");
    if (unread.length > 0) {
      setLocalStatus((s) => {
        const next = { ...s };
        for (const m of unread) next[m.$id] = "read";
        return next;
      });
      await Promise.all(
        unread.map((m) =>
          fetch(`/api/inbox/${m.$id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "read" }),
          })
        )
      );
      router.refresh();
    }
  }

  async function remove(messageId: string) {
    if (!window.confirm("Delete this email from your inbox?")) return;
    setDeletingId(messageId);
    await fetch(`/api/inbox/${messageId}`, { method: "DELETE" });
    setDeletingId(null);
    router.refresh();
    if (selected) {
      const res = await fetch(`/api/inbox/thread?email=${encodeURIComponent(selected)}`);
      const data = await res.json();
      const messages: ThreadMessage[] = data.messages ?? [];
      if (messages.some((m) => m.direction === "in")) {
        setThread(messages);
      } else {
        setSelected(null);
        setThread(null);
      }
    }
  }

  async function sendReply() {
    const convo = conversations.find((c) => c.counterparty === selected);
    if (!convo || !replyText.trim()) return;
    setReplyBusy(true);
    setReplyMsg("");
    try {
      let uploaded: { id: string; name: string }[] = [];
      if (replyFiles.length > 0) {
        setReplyMsg(`Uploading ${replyFiles.length} attachment(s)…`);
        uploaded = await Promise.all(replyFiles.map(uploadToAppwrite));
      }
      setReplyMsg("");
      const res = await fetch(`/api/inbox/${convo.latest.$id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText.trim(), files: uploaded }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplyText("");
        setReplyFiles([]);
        setReplyAttachmentsKey((k) => k + 1);
        setReplyMsg("Reply sent.");
        await loadThread(convo.counterparty);
      } else {
        setReplyMsg(data.error ?? "Failed to send reply.");
      }
    } catch (err) {
      setReplyMsg((err as Error).message);
    }
    setReplyBusy(false);
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
          {conversations.map((c) => {
            const active = selected === c.counterparty;
            const unread = c.unreadCount > 0;
            return (
              <li key={c.counterparty}>
                <button
                  onClick={() => open(c)}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-mist ${active ? "bg-mist" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={unread ? "font-semibold" : "text-charcoal"}>{c.counterparty}</span>
                    <span className="shrink-0 text-xs text-smoke">{timeAgo(c.latest.receivedAt)}</span>
                  </div>
                  <div className={`mt-0.5 truncate ${unread ? "font-medium" : "text-smoke"}`}>
                    {c.latest.subject || "(no subject)"}
                    {c.messages.length > 1 && (
                      <span className="ml-1.5 text-xs text-smoke/70">({c.messages.length})</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-lg border border-charcoal/10 bg-white p-5">
        {!selected && <p className="text-sm text-smoke/70">Select a conversation to read it.</p>}
        {selected && threadLoading && <p className="text-sm text-smoke/70">Loading…</p>}
        {selected && thread && !threadLoading && (
          <div>
            <h2 className="font-display text-lg font-semibold">{selected}</h2>

            <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto">
              {thread.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg border p-3 ${
                    m.direction === "out"
                      ? "border-gold/30 bg-gold/5"
                      : "border-charcoal/10 bg-mist/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-smoke">
                    <span className="font-medium text-charcoal">
                      {m.direction === "out" ? "You replied" : selected}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{new Date(m.at).toLocaleString()}</span>
                      {m.direction === "in" && (
                        <button
                          onClick={() => remove(m.id)}
                          disabled={deletingId === m.id}
                          className="text-smoke/60 hover:text-red-600 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mb-2 text-sm font-medium text-charcoal">{m.subject || "(no subject)"}</p>
                  {m.html ? (
                    <iframe
                      title="Email content"
                      srcDoc={m.html}
                      sandbox=""
                      className="h-48 w-full rounded border-0 bg-white"
                    />
                  ) : (
                    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm">
                      {m.text || "(empty message)"}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-charcoal/10 pt-4">
              <h3 className="mb-2 text-sm font-semibold">Reply to {selected}</h3>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your reply…"
                rows={5}
                className="w-full rounded-md border border-charcoal/20 px-3 py-2 text-sm focus:border-gold focus:outline-none"
              />
              <div className="mt-2">
                <AttachmentPicker
                  key={replyAttachmentsKey}
                  files={replyFiles}
                  onChange={setReplyFiles}
                  disabled={replyBusy}
                />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={sendReply}
                  disabled={replyBusy || !replyText.trim() || attachmentsTooBig(replyFiles)}
                  className={btnCls}
                >
                  {replyBusy ? "Sending…" : "Send reply"}
                </button>
                {replyMsg && <span className="text-sm text-smoke">{replyMsg}</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
