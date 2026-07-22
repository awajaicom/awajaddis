import * as React from "react";
import { EmailLayout, P } from "../components/layout";

export interface ColdProps {
  firstName?: string;
  company?: string;
  email?: string;
}

export default function ColdIntro({ firstName = "there", company = "your business" }: ColdProps) {
  return (
    <EmailLayout preview={`Quick idea for ${company}`}>
      <P>Hi {firstName},</P>
      <P>
        I came across {company} and noticed you’re active on social media but might not be
        getting the customer inquiries to match the effort.
      </P>
      <P>
        We help Ethiopian SMEs turn content, social media, and paid ads into a steady stream
        of the right customers — one team handling all of it, so you can focus on the business.
      </P>
      <P>
        Would it be worth a 15-minute call this week to show you what that could look like for{" "}
        {company}? No pitch deck — just two or three concrete ideas you can use either way.
      </P>
      <P>
        Best,
        <br />
        Abu
        <br />
        Awaj ET · Digital Marketing for Ethiopian SMEs
      </P>
    </EmailLayout>
  );
}
