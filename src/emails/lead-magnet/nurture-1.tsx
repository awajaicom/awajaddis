import * as React from "react";
import { EmailLayout, P } from "../components/layout";
import type { LeadMagnetProps } from "./lead-magnet-delivery";

export default function Nurture1({ firstName = "there", email = "" }: LeadMagnetProps) {
  return (
    <EmailLayout preview="The #1 mistake we see SMEs make" footer="marketing" recipientEmail={email}>
      <P>Hi {firstName},</P>
      <P>
        Did you get a chance to look through the playbook? Here’s the mistake we see most
        often: posting content about <em>your business</em> instead of about{" "}
        <em>your customer’s problem</em>. Flip that, and engagement follows.
      </P>
      <P>
        Try this today: take your last three posts and rewrite each headline as a question
        your ideal customer is already asking. That one change usually doubles reach.
      </P>
      <P>
        Tomorrow I’ll share how one client turned this into 30+ inquiries a week.
      </P>
      <P>— Abu, Awaj ET</P>
    </EmailLayout>
  );
}
