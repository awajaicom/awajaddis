import * as React from "react";
import { EmailLayout, P } from "../components/layout";

/**
 * Lightweight, natural-looking email used during warm-up to seed inboxes you
 * control (or partner inboxes that will open/reply). Never send warm-up
 * pings to strangers.
 */
export default function WarmupPing({ note = "የሸራር ቢዝነስ ጀማ" }: { note?: string }) {
  return (
    <EmailLayout preview={note}>
      <P>ሰላም,</P>
      <P>{note}</P>
      <P>
        ከምስጋና ጋር,
        <br />
        ቆጠር
      </P>
    </EmailLayout>
  );
}
