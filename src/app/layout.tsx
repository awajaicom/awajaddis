import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Awaj Outreach",
  description: "Cold email, lead magnets, warm-up and transactional email — one engine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-mist font-sans text-charcoal antialiased">{children}</body>
    </html>
  );
}
