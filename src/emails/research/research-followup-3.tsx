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
    <EmailLayout preview={`${industry} Research Insights for ${company}`}>
      <P>Selam {firstName},</P>
      <P>
       I wanted to share a quick insight from our ongoing research into digital marketing in the {industry} sector.
      </P>
      <P>
        We’re finding that ...
      </P>
      <P>
        To help businesses act on this, we created a simple "Lead Magnet Name" with practical tips and a checklist to help you evaluate your current digital marketing efforts.
      </P>
      <P>
        I've attached it here in case you find it useful.
      </P><P>
        We’d also love to hear your perspective as part of our research. If you're open to it, I can send over a short questionnaire. As a thank-you, we'll also provide one of these services:
      </P>
       <P>
        • Professional brand guideline setup
        <br />
        • Professional photo/video production
        <br />
        • AI-powered content production
      </P>
      <P>
        Thanks, and let me know if you want me to send it over.
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
