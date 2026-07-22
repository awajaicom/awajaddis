import * as React from "react";
import { EmailLayout, P } from "../components/layout";

/**
 * Lightweight, natural-looking email used during warm-up to seed inboxes you
 * control (or partner inboxes that will open/reply). Never send warm-up
 * pings to strangers.
 */
export default function WarmupPing({ note = "Checking in on this week's schedule." }: { note?: string }) {
  return (
    <EmailLayout preview={note}>
      <P>Hi,</P>
      <P>{note}</P>
      <P>
        Best,
        <br />
        Abu
      </P>
    </EmailLayout>
  );
}
