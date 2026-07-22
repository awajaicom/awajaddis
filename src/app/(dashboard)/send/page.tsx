import { TEMPLATES } from "@/emails/registry";
import { SendTabs } from "./send-tabs";

export const dynamic = "force-dynamic";

export default function SendPage() {
  const templates = Object.entries(TEMPLATES).map(([key, t]) => ({
    key,
    defaultSubject: t.defaultSubject,
    category: t.category,
    description: t.description,
  }));

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-bold">Send email</h1>
      <p className="mb-6 text-sm text-smoke">
        One-off manual sends — from a template, or compose free text with attachments. Both go
        through the same pipeline: suppression check, logging, and unsubscribe headers all apply.
      </p>
      <SendTabs templates={templates} />
    </div>
  );
}
