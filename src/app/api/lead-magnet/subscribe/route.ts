import { NextRequest, NextResponse } from "next/server";
import { COLLECTIONS, DB, ID, Query, db, type Campaign } from "@/lib/appwrite";
import { renderTemplate } from "@/emails/registry";
import { sendEmail } from "@/lib/send";
import { enroll } from "@/lib/sequence-engine";

/**
 * Public endpoint for lead-magnet opt-in forms on your site.
 *
 *   POST /api/lead-magnet/subscribe
 *   { "email": "...", "firstName"?: "...", "downloadUrl"?: "...",
 *     "resourceName"?: "...", "nurtureCampaignId"?: "..." }
 *
 * Creates/updates the contact, sends the delivery email immediately, and
 * optionally enrolls them into a nurture campaign.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").toLowerCase().trim();
  if (!email.includes("@")) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  // Upsert contact
  const existing = await db().listDocuments(DB(), COLLECTIONS.contacts, [
    Query.equal("email", email),
    Query.limit(1),
  ]);
  let contactId: string;
  if (existing.total > 0) {
    contactId = existing.documents[0].$id;
  } else {
    const doc = await db().createDocument(DB(), COLLECTIONS.contacts, ID.unique(), {
      email,
      firstName: body.firstName ?? "",
      lastName: "",
      company: "",
      status: "active",
      source: "lead_magnet",
      tags: ["lead-magnet"],
      notes: "",
    });
    contactId = doc.$id;
  }

  // Instant delivery email
  const rendered = renderTemplate("lead-magnet-delivery", {
    firstName: body.firstName ?? "there",
    email,
    downloadUrl: body.downloadUrl,
    resourceName: body.resourceName,
  })!;
  await sendEmail({
    to: email,
    subject: body.resourceName ? `Your copy of ${body.resourceName} 🎉` : rendered.defaultSubject,
    react: rendered.element,
    category: "lead_magnet",
    contactId,
    templateKey: "lead-magnet-delivery",
  });

  // Optional nurture enrollment
  if (body.nurtureCampaignId) {
    const campaign = (await db().getDocument(
      DB(), COLLECTIONS.campaigns, body.nurtureCampaignId
    )) as unknown as Campaign;
    const already = await db().listDocuments(DB(), COLLECTIONS.enrollments, [
      Query.equal("contactId", contactId),
      Query.equal("campaignId", campaign.$id),
      Query.limit(1),
    ]);
    if (already.total === 0) await enroll(contactId, campaign);
  }

  return NextResponse.json({ ok: true });
}
