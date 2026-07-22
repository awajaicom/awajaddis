import * as React from "react";
import { EmailLayout, P } from "./components/layout";

export interface FreeFormProps {
  body?: string;
  email?: string;
  /** "plain" reads like a personal note; "branded" adds logo + marketing footer. */
  style?: "plain" | "branded";
}

/** Free-form email: renders open text (paragraphs split on blank lines). */
export default function FreeForm({ body = "", email = "", style = "plain" }: FreeFormProps) {
  const paragraphs = body.replace(/\r\n/g, "\n").split(/\n{2,}/).filter((p) => p.trim());
  return (
    <EmailLayout
      preview={paragraphs[0]?.slice(0, 90) ?? ""}
      footer={style === "branded" ? "marketing" : "none"}
      recipientEmail={email}
    >
      {paragraphs.map((p, i) => (
        <P key={i}>
          {p.split("\n").map((line, j, arr) => (
            <React.Fragment key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </P>
      ))}
    </EmailLayout>
  );
}
