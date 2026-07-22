import { Button, Section } from "@react-email/components";
import * as React from "react";
import { EmailLayout, P, ctaStyle } from "../components/layout";
import type { LeadMagnetProps } from "./lead-magnet-delivery";

const APP_URL = process.env.APP_URL ?? "https://example.com";

export default function Nurture2({ firstName = "there", email = "" }: LeadMagnetProps) {
  return (
    <EmailLayout preview="Want us to look at your marketing together?" footer="marketing" recipientEmail={email}>
      <P>Hi {firstName},</P>
      <P>
        Quick story: a retail client came to us posting daily with almost no results. We
        rebuilt their content around customer questions, added a small, tightly-targeted ad
        budget, and within two months they went from ~5 inquiries a week to 30+.
      </P>
      <P>
        If you’d like, we’ll do the same diagnosis for your business — free, 20 minutes, and
        you keep the recommendations whether we work together or not.
      </P>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button href={`${APP_URL}/book`} style={ctaStyle}>
          Book a free marketing review
        </Button>
      </Section>
      <P>— Abu, Awaj ET</P>
    </EmailLayout>
  );
}
