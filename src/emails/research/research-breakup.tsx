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
    <EmailLayout preview={`We are concluding the ${industry} research`}>
      <P>Selam {firstName},</P>
      <P>
       I wanted to send one final follow-up regarding my research request.
      </P>
      <P>
        If this isn't something you're interested in or you're not the right person, no worries at all. 
        Just let me know, and I won't follow up again.
      </P>
      <P>
        If you'd still be open to answering a few quick questions, 
        I'd be happy to send them over and arrange your thank you service afterward.
      </P>
      <P>
        Please notify me if you want to participate before we conclude this week.
      </P>
      <P>
        Thanks for your time again. If you need any professional help with digital marketing, my inbox is always open.
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
