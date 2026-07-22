import { Button, Section } from "@react-email/components";
import * as React from "react";
import { EmailLayout, H, P, ctaStyle } from "../components/layout";

export interface LeadMagnetProps {
  firstName?: string;
  email?: string;
  downloadUrl?: string;
  resourceName?: string;
}

export default function LeadMagnetDelivery({
  firstName = "there",
  email = "",
  downloadUrl = "https://awajet.com/downloads/marketing-playbook1",
  resourceName = "the SME Marketing Playbook",
}: LeadMagnetProps) {
  return (
    <EmailLayout preview={`Your copy of ${resourceName} is here`} footer="marketing" recipientEmail={email}>
      <H>Here’s your download, {firstName}</H>
      <P>
        Thanks for grabbing {resourceName}. It’s packed with practical steps you can apply to
        your business this week — no fluff.
      </P>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button href={downloadUrl} style={ctaStyle}>
          Download {resourceName}
        </Button>
      </Section>
      <P>
        Over the next few days I’ll send a couple of short emails with our best ideas for
        getting more of the right customers. If you’d rather not, the unsubscribe link below
        works instantly.
      </P>
      <P>— Aman, Awaj ET</P>
    </EmailLayout>
  );
}
