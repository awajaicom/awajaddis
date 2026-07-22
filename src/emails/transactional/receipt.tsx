import { Column, Row, Section } from "@react-email/components";
import * as React from "react";
import { EmailLayout, H, P, brand } from "../components/layout";

export interface ReceiptProps {
  firstName?: string;
  invoiceNumber?: string;
  amount?: string;
  service?: string;
  date?: string;
}

export default function Receipt({
  firstName = "there",
  invoiceNumber = "INV-0001",
  amount = "ETB 0.00",
  service = "Marketing services",
  date = new Date().toLocaleDateString("en-GB"),
}: ReceiptProps) {
  const cell = { fontSize: "14px", color: brand.charcoal, padding: "8px 0" };
  const label = { ...cell, color: brand.smoke, fontFamily: brand.bodyFont };
  return (
    <EmailLayout preview={`Receipt ${invoiceNumber} — ${amount}`} footer="transactional">
      <H>Payment received — thank you, {firstName}</H>
      <Section
        style={{
          border: `1px solid ${brand.line}`,
          borderRadius: "8px",
          padding: "16px",
          backgroundColor: brand.mist,
        }}
      >
        <Row><Column style={label}>Invoice</Column><Column style={{ ...cell, textAlign: "right" as const }}>{invoiceNumber}</Column></Row>
        <Row><Column style={label}>Service</Column><Column style={{ ...cell, textAlign: "right" as const }}>{service}</Column></Row>
        <Row><Column style={label}>Date</Column><Column style={{ ...cell, textAlign: "right" as const }}>{date}</Column></Row>
        <Row><Column style={{ ...label, fontWeight: 600 }}>Total</Column><Column style={{ ...cell, textAlign: "right" as const, fontWeight: 600, color: brand.amber }}>{amount}</Column></Row>
      </Section>
      <P>Keep this email for your records. Questions? Just reply.</P>
    </EmailLayout>
  );
}
