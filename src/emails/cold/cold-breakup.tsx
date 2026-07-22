import * as React from "react";
import { EmailLayout, P } from "../components/layout";
import type { ColdProps } from "./cold-intro";

export default function ColdBreakup({ firstName = "there", company = "your business" }: ColdProps) {
  return (
    <EmailLayout preview="Closing the loop">
      <P>Hi {firstName},</P>
      <P>
        I’ll take the silence as “not right now” and close the loop — this is my last email.
      </P>
      <P>
        If growing {company} through better marketing becomes a priority later, my inbox is
        always open. Wishing you a strong quarter either way.
      </P>
      <P>
        Best,
        <br />
        Abu · Awaj ET
      </P>
    </EmailLayout>
  );
}
