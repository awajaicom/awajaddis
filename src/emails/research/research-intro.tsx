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
    <EmailLayout preview={`Research Partnership Request for ${company}`}>
      <P>Selam {firstName},</P>
      <P>
        I’m reaching out because we’re currently doing research on the impact of digital marketing in the {industry} sector, and we’d love to hear from companies like {company}.
      </P>
      <P>
        Would you be open to answering a few quick questions? It won’t take much of your time,
        and as a thank-you, we’ll offer you a free service from one of these three options:
      </P>
      <P>
        • Professional brand guideline setup
        <br />
        • Professional photo/video production
        <br />
        • AI-powered content production
      </P>
      <P>
        Is this the right email to send the questionnaire to? If not, could you please refer me to the right person?
      </P>
      <P>
        Thanks for your time, and I hope to hear from you.
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
