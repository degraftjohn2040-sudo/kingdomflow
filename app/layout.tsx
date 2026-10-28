import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KingdomFlow — Members. Ministry. Growth.", template: "%s · KingdomFlow" },
  description:
    "KingdomFlow is the church and ministry management platform for members, attendance, giving, events and growth across every branch.",
  applicationName: "KingdomFlow",
  openGraph: {
    title: "KingdomFlow",
    description: "Members. Ministry. Growth. One Platform.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#101019",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
