import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

const APP_URL = process.env.APP_URL ?? "https://example.com";

/* Awaj ET brand tokens (brand guide v1.0) */
export const brand = {
  gold: "#F0A93B",
  amber: "#C97D1E",
  navy: "#12121C",
  charcoal: "#2B2B33",
  mist: "#F7F3EC",
  smoke: "#6B6873",
  line: "rgba(43,43,51,0.12)",
  // Space Grotesk isn't installed on recipients' machines; the stack degrades
  // gracefully. Email clients block webfonts, so system fallbacks carry it.
  displayFont: "'Space Grotesk', 'Segoe UI', Arial, sans-serif",
  bodyFont: "'Inter', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

export interface LayoutProps {
  preview: string;
  children: React.ReactNode;
  /**
   * marketing / transactional — branded: logo header + footer.
   * none — deliberately plain (cold outreach reads as a personal note;
   * logos and heavy styling hurt reply rates and deliverability).
   */
  footer?: "marketing" | "transactional" | "none";
  recipientEmail?: string;
}

export function EmailLayout({ preview, children, footer = "none", recipientEmail }: LayoutProps) {
  const unsubUrl = `${APP_URL}/api/unsubscribe?email=${encodeURIComponent(recipientEmail ?? "")}`;
  const branded = footer !== "none";
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: branded ? brand.mist : "#ffffff", fontFamily: brand.bodyFont, margin: 0, padding: branded ? "24px 0" : 0 }}>
        <Container
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            padding: "24px",
            backgroundColor: "#ffffff",
            borderRadius: branded ? "8px" : undefined,
          }}
        >
          {branded && (
            <Section style={{ marginBottom: "24px" }}>
              {/* PNG, not SVG — Gmail/Outlook don't render SVG. Drop logo.png into /public. */}
              <Img
                src={`${APP_URL}/logo.png`}
                alt="Awaj ET"
                width="36"
                height="36"
              />
            </Section>
          )}
          {children}
          {footer === "marketing" && (
            <Section>
              <Hr style={{ borderColor: brand.line, margin: "28px 0 12px" }} />
              <Text style={{ fontSize: "12px", color: brand.smoke, lineHeight: "18px" }}>
                Awaj ET — All-in-one digital marketing solution for Ethiopian Businesses. 
                <br />
                You’re receiving this because you signed up or downloaded a resource from us.{" "}
                <Link href={unsubUrl} style={{ color: brand.smoke, textDecoration: "underline" }}>
                  Unsubscribe
                </Link>
              </Text>
            </Section>
          )}
          {footer === "transactional" && (
            <Section>
              <Hr style={{ borderColor: brand.line, margin: "28px 0 12px" }} />
              <Text style={{ fontSize: "12px", color: brand.smoke }}>
                Awaj ET · This is a service email about your account.
              </Text>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}

/** Plain-text-looking paragraph — cold emails deliver best with minimal styling. */
export function P({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: "15px", lineHeight: "24px", color: brand.charcoal, margin: "0 0 16px" }}>
      {children}
    </Text>
  );
}

/** Branded heading for marketing/transactional emails. */
export function H({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: brand.displayFont,
        fontSize: "22px",
        fontWeight: 700,
        color: brand.charcoal,
        letterSpacing: "-0.01em",
        margin: "0 0 16px",
      }}
    >
      {children}
    </Text>
  );
}

/** Brand CTA button style: Solar Gold with Ink Navy text (never gold-on-white text). */
export const ctaStyle: React.CSSProperties = {
  backgroundColor: brand.gold,
  color: brand.navy,
  padding: "12px 28px",
  borderRadius: "6px",
  fontSize: "15px",
  fontWeight: 600,
  fontFamily: brand.displayFont,
  textDecoration: "none",
};
