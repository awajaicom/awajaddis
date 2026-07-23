import * as React from "react";
import { EmailLayout, P } from "../components/layout";

export interface ColdProps {
  firstName?: string;
  company?: string;
  email?: string;
  industry?:string;
}

export default function ColdIntro({ firstName = "", industry = "Ethiopian business", company = "your business" }: ColdProps) {
  return (
    <EmailLayout preview={`Research Questions Follow-up for ${company}`}>
      <P>Selam {firstName},</P>
      <P>
       Just checking in one more time regarding my research request.
      </P>
      <P>
        We’d really value your input as {industry} business. The questionnaire is short, 
        and we’d be happy to provide a free brand guideline setup, photo/video production, or AI-powered content as a thank-you.
      </P>
      <P>
        If you’re not the right person to answer, could you point me to the person who handles marketing or communications at {company}?
      </P>
      <P>
        Thanks for your time again, and I hope to hear from you.
      </P>
      <P>
        Best,
        <br />
        Kalkidan Berihun
        <br />
        Awaj ET
      </P>
    </EmailLayout>
  );
}
