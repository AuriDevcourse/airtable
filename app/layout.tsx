import type { Metadata } from "next";
import { Onest, Inter } from "next/font/google";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TechBBQ Airtable Connector",
  description: "Safe JSON feed of website-approved speakers for WordPress.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${onest.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
