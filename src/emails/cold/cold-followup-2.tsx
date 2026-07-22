import * as React from "react";
import { EmailLayout, P } from "../components/layout";
import type { ColdProps } from "./cold-intro";

export default function ColdFollowup2({ firstName = "there" }: ColdProps) {
  return (
    <EmailLayout preview="A free resource, no strings">
      <P>Hi {firstName},</P>
      <P>
        I know inboxes are busy, so instead of asking for time, here’s something useful for
        free: our one-page checklist, “7 Marketing Mistakes Costing Ethiopian SMEs Customers.”
        Reply “checklist” and I’ll send it over.
      </P>
      <P>
        If marketing isn’t a priority right now, no problem at all — just let me know and I’ll
        stop following up.
      </P>
      <P>
        Best,
        <br />
        Abu · Awaj ET
      </P>
    </EmailLayout>
  );
}
