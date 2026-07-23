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
    <EmailLayout preview={`Research Collaboration for ${company}`}>
      <P>Selam {firstName},</P>
      <P>
       Just wanted to follow up on my email below in case you missed it.
      </P>
      <P>
        We’re currently researching the impacts of digital marketing in the {industry} sector and would really appreciate your perspective.
      </P>
      <P>
        It’s just a few quick questions, and as a thank-you for your time, we’ll provide one of these services:
      </P>
      <P>
        • Professional brand guideline setup
        <br />
        • Professional photo/video production
        <br />
        • AI-powered content production
      </P>
      <P>
        Would this be the right email to send the questionnaire to?
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
