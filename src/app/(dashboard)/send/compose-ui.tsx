"use client";

import { useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { DEFAULT_SENDER, SENDERS } from "@/lib/senders";

const SENDER_OPTIONS = SENDERS.map((s) => ({
  value: s.email,
  label: `${s.name} — ${s.email}`,
}));

const inputCls =
  "w-full min-h-10 rounded-md border border-charcoal/20 px-3 py-2 text-sm focus:border-gold focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-smoke";

const STYLE_OPTIONS = [
  { value: "plain", label: "Plain — personal note (no logo/footer)" },
  { value: "branded", label: "Branded — logo + unsubscribe footer" },
];

function fmtSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Upload straight from the browser to Appwrite Storage — bypasses Vercel's
 * 4.5 MB request-body cap. The bucket is write-only for anonymous users;
 * the server reads the file by ID and deletes it after sending.
 */
async function uploadToAppwrite(file: File): Promise<{ id: string; name: string }> {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const bucket = process.env.NEXT_PUBLIC_APPWRITE_ATTACHMENTS_BUCKET_ID ?? "attachments";
  if (!endpoint || !project) {
    throw new Error("NEXT_PUBLIC_APPWRITE_ENDPOINT and NEXT_PUBLIC_APPWRITE_PROJECT_ID must be set");
  }
  const form = new FormData();
  form.set("fileId", "unique()");
  form.set("file", file);
  const res = await fetch(`${endpoint}/storage/buckets/${bucket}/files`, {
    method: "POST",
    headers: { "X-Appwrite-Project": project },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? `Upload failed for ${file.name}`);
  return { id: data.$id, name: file.name };
}

export function ComposeForm() {
  const [from, setFrom] = useState(DEFAULT_SENDER);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [style, setStyle] = useState("plain");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const tooBig = totalSize > 15 * 1024 * 1024;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      let uploaded: { id: string; name: string }[] = [];
      if (files.length > 0) {
        setResult({ ok: true, text: `Uploading ${files.length} attachment(s)…` });
        uploaded = await Promise.all(files.map(uploadToAppwrite));
      }
      setResult(null);
      const res = await fetch("/api/send/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, body, style, files: uploaded }),
      });
      const data = await res.json();
      setResult(
        res.ok
          ? { ok: true, text: `Sent to ${to}${data.attachments ? ` with ${data.attachments} attachment(s)` : ""}.` }
          : { ok: false, text: data.error ?? "Send failed." }
      );
      if (res.ok) {
        setBody("");
        setFiles([]);
        if (fileInput.current) fileInput.current.value = "";
      }
    } catch (err) {
      setResult({ ok: false, text: (err as Error).message });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={send} className="max-w-2xl space-y-5">
      <div className="rounded-lg border border-charcoal/10 bg-white p-4 sm:p-5">
        <div className="grid gap-4">
          <div>
            <label className={labelCls}>Send as</label>
            <Select value={from} onValueChange={setFrom} options={SENDER_OPTIONS} />
          </div>
          <div>
            <label className={labelCls}>To *</label>
            <input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Subject *</label>
            <input required value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Message * (blank line starts a new paragraph)</label>
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder={"Hi Sara,\n\nGreat speaking with you today…\n\nBest,\nAman"}
              className={`${inputCls} resize-y font-sans leading-6`}
            />
          </div>
          <div>
            <label className={labelCls}>Email style</label>
            <Select value={style} onValueChange={setStyle} options={STYLE_OPTIONS} />
          </div>
          <div>
            <label className={labelCls}>Attachments (max 15 MB total)</label>
            <input
              ref={fileInput}
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-smoke file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-amber hover:file:bg-gold/25"
            />
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-smoke">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0">{fmtSize(f.size)}</span>
                  </li>
                ))}
                <li className={`pt-1 font-medium ${tooBig ? "text-red-600" : ""}`}>
                  Total: {fmtSize(totalSize)} {tooBig && "— over the 15 MB limit"}
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          disabled={busy || !to || !subject || !body || tooBig}
          className="w-full rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-navy hover:bg-amber disabled:opacity-50 sm:w-auto"
        >
          {busy ? "Sending…" : "Send email"}
        </button>
        {result && (
          <span className={`text-sm ${result.ok ? "text-amber" : "text-red-600"}`}>{result.text}</span>
        )}
      </div>
    </form>
  );
}
