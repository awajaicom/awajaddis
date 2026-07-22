import * as React from "react";
import { EmailLayout, H, P } from "../components/layout";

export interface WelcomeProps {
  firstName?: string;
}

export default function Welcome({ firstName = "there" }: WelcomeProps) {
  return (
    <EmailLayout preview="Welcome to Awaj ET" footer="transactional">
      <H>Welcome aboard, {firstName}!</H>
      <P>
        Your account is ready. You can log in anytime to view your campaigns, reports, and
        invoices.
      </P>
      <P>
        If you didn’t create this account, just reply to this email and we’ll sort it out.
      </P>
      <P>— The Awaj ET team</P>
    </EmailLayout>
  );
}
