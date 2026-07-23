import { createElement, type ReactElement } from "react";
import ColdIntro from "./cold/cold-intro";
import ColdFollowup1 from "./cold/cold-followup-1";
import ColdFollowup2 from "./cold/cold-followup-2";
import ColdBreakup from "./cold/cold-breakup";
import ResearchIntro from "./research/research-intro";
import ResearchFollowup1 from "./research/research-followup-1";
import ResearchFollowup2 from "./research/research-followup-2";
import ResearchFollowup3 from "./research/research-followup-3";
import ResearchBreakup from "./research/research-breakup";
import LeadMagnetDelivery from "./lead-magnet/lead-magnet-delivery";
import Nurture1 from "./lead-magnet/nurture-1";
import Nurture2 from "./lead-magnet/nurture-2";
import Welcome from "./transactional/welcome";
import Receipt from "./transactional/receipt";
import WarmupPing from "./warmup/warmup-ping";

export interface TemplateVars {
  firstName?: string;
  lastName?: string;
  company?: string;
  email?: string;
  [key: string]: unknown;
}

interface TemplateEntry {
  component: (props: TemplateVars) => ReactElement;
  defaultSubject: string;
  category: "cold" | "lead_magnet" | "transactional" | "warmup" | "nurture";
  description: string;
}

/**
 * Every sendable template, keyed by templateKey. Sequence steps reference
 * these keys, so adding a template here makes it available to the dashboard.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  "cold-intro": {
    component: (p) => createElement(ColdIntro, p),
    defaultSubject: "Quick idea for {{company}}",
    category: "cold",
    description: "Step 1 — short personalized opener with a soft CTA",
  },
  "cold-followup-1": {
    component: (p) => createElement(ColdFollowup1, p),
    defaultSubject: "Re: Quick idea for {{company}}",
    category: "cold",
    description: "Step 2 — social proof follow-up (day 3)",
  },
  "cold-followup-2": {
    component: (p) => createElement(ColdFollowup2, p),
    defaultSubject: "A free checklist for {{company}}",
    category: "cold",
    description: "Step 3 — value-first offer (day 7)",
  },
  "cold-breakup": {
    component: (p) => createElement(ColdBreakup, p),
    defaultSubject: "Closing the loop, {{firstName}}",
    category: "cold",
    description: "Step 4 — polite breakup (day 14)",
  },
  "research-intro": {
    component: (p) => createElement(ResearchIntro, p),
    defaultSubject: "Quick research question for {{company}}",
    category: "cold",
    description: "Research step 1 — questionnaire ask with a free-service incentive",
  },
  "research-followup-1": {
    component: (p) => createElement(ResearchFollowup1, p),
    defaultSubject: "Re: Quick research question for {{company}}",
    category: "cold",
    description: "Research step 2 — follow-up in case the first email was missed (day 3)",
  },
  "research-followup-2": {
    component: (p) => createElement(ResearchFollowup2, p),
    defaultSubject: "Following up — research for {{company}}",
    category: "cold",
    description: "Research step 3 — second follow-up, offers to redirect to the right contact (day 7)",
  },
  "research-followup-3": {
    component: (p) => createElement(ResearchFollowup3, p),
    defaultSubject: "A quick insight + resource for {{company}}",
    category: "cold",
    description: "Research step 4 — shares an insight and lead magnet alongside the questionnaire ask (day 10)",
  },
  "research-breakup": {
    component: (p) => createElement(ResearchBreakup, p),
    defaultSubject: "Closing the loop on our research, {{firstName}}",
    category: "cold",
    description: "Research step 5 — polite breakup, final research request (day 14)",
  },
  "lead-magnet-delivery": {
    component: (p) => createElement(LeadMagnetDelivery, p),
    defaultSubject: "Your download is here 🎉",
    category: "lead_magnet",
    description: "Instant delivery email with download button",
  },
  "nurture-1": {
    component: (p) => createElement(Nurture1, p),
    defaultSubject: "The #1 mistake we see SMEs make",
    category: "nurture",
    description: "Nurture — actionable tip (day 2)",
  },
  "nurture-2": {
    component: (p) => createElement(Nurture2, p),
    defaultSubject: "From 5 to 30 inquiries a week (case study)",
    category: "nurture",
    description: "Nurture — case study + booking CTA (day 4)",
  },
  welcome: {
    component: (p) => createElement(Welcome, p),
    defaultSubject: "Welcome to Awaj ET",
    category: "transactional",
    description: "Account welcome email",
  },
  receipt: {
    component: (p) => createElement(Receipt, p),
    defaultSubject: "Your receipt from Awaj ET",
    category: "transactional",
    description: "Payment receipt",
  },
  "warmup-ping": {
    component: (p) =>
      createElement(WarmupPing, {
        note: typeof p.note === "string" ? p.note : undefined,
      }),
    defaultSubject: "Quick check-in",
    category: "warmup",
    description: "Warm-up seed email (send to inboxes you control)",
  },
};

export function renderTemplate(
  key: string,
  vars: TemplateVars
): { element: ReactElement; defaultSubject: string } | null {
  const entry = TEMPLATES[key];
  if (!entry) return null;
  return { element: entry.component(vars), defaultSubject: entry.defaultSubject };
}
