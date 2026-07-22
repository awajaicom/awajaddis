import * as React from "react";
import { EmailLayout, P } from "../components/layout";
import type { ColdProps } from "./cold-intro";

export default function ColdFollowup1({ firstName = "there", company = "your business" }: ColdProps) {
  return (
    <EmailLayout preview="One example I forgot to mention">
      <P>ሰላም {firstName},</P>
      <P>
        Following up on my last note — one thing I should have led with: a local retail client
        of ours went from ~5 inquiries a week to 30+ in two months, purely from restructured
        social content and a small ad budget spent properly.
      </P>
      <P>
        I’d be happy to walk you through exactly what we did and whether the same playbook fits{" "}
        {company}. Would Tuesday or Thursday afternoon work for a quick call?
      </P>
      <P>
        Best,
        <br />
        Abu · Awaj ET
      </P>
    </EmailLayout>
  );
}
