"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputCls =
  "w-full rounded-md border border-charcoal/20 px-3 py-2 text-sm focus:border-gold focus:outline-none";
const btnCls =
  "rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-amber disabled:opacity-50";

export function ContactForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const form = new FormData(e.currentTarget);
    const tags = String(form.get("tags") ?? "")
      .split(",").map((t) => t.trim()).filter(Boolean);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        company: form.get("company"),
        phone: form.get("phone"),
        tags,
      }),
    });
    const data = await res.json();
    setMsg(data.created ? "Contact added." : `Skipped: ${data.skipped?.join(", ")}`);
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-charcoal/10 bg-white p-5">
      <h2 className="mb-3 font-semibold">Add contact</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="email" type="email" placeholder="Email *" required className={inputCls} />
        <input name="company" placeholder="Company" className={inputCls} />
        <input name="firstName" placeholder="First name" className={inputCls} />
        <input name="lastName" placeholder="Last name" className={inputCls} />
        <input name="phone" placeholder="Phone (e.g. 0911234567)" className={inputCls} />
        <input name="tags" placeholder="Tags (comma-separated)" className={inputCls} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button disabled={busy} className={btnCls}>Add</button>
        {msg && <span className="text-sm text-smoke">{msg}</span>}
      </div>
    </form>
  );
}

/** CSV columns: email,firstName,lastName,company,phone,tags (tags separated by ;) */
export function CsvImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg("Parsing…");
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const contacts = lines.slice(1).map((line) => {
      const cols = line.split(",");
      return {
        email: cols[idx("email")]?.trim(),
        firstName: cols[idx("firstname")]?.trim() ?? "",
        lastName: cols[idx("lastname")]?.trim() ?? "",
        company: cols[idx("company")]?.trim() ?? "",
        phone: cols[idx("phone")]?.trim() ?? "",
        tags: (cols[idx("tags")] ?? "").split(";").map((t) => t.trim()).filter(Boolean),
        source: "import",
      };
    }).filter((c) => c.email?.includes("@"));

    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts }),
    });
    const data = await res.json();
    setMsg(`Imported ${data.created}; skipped ${data.skipped?.length ?? 0} (duplicates/invalid).`);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-charcoal/10 bg-white p-5">
      <h2 className="mb-3 font-semibold">Import CSV</h2>
      <p className="mb-3 text-sm text-smoke">
        Columns: <code>email,firstName,lastName,company,phone,tags</code> (tags separated by <code>;</code>)
      </p>
      <input type="file" accept=".csv" onChange={onFile} disabled={busy} className="text-sm" />
      {msg && <p className="mt-3 text-sm text-smoke">{msg}</p>}
    </div>
  );
}

/** Manual SMS opt-out for one contact's phone. Only affects SMS suppression/enrollments — email consent is untouched. */
export function SmsOptOutButton({ phone }: { phone: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function optOut() {
    if (!window.confirm(`Opt "${phone}" out of SMS? This stops their active SMS sequences.`)) return;
    setBusy(true);
    const res = await fetch("/api/sms-suppressions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "Failed to opt out.");
      return;
    }
    router.refresh();
  }

  return (
    <button
      disabled={busy}
      onClick={optOut}
      className="text-xs text-red-500 hover:underline disabled:opacity-50"
    >
      Opt out of SMS
    </button>
  );
}
