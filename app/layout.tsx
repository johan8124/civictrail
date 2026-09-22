import type { Metadata } from "next";
import { Anton, Condiment, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

const condiment = Condiment({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-condiment",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CivicTrail — Turn a problem into an action-ready case",
  description:
    "Evidence-first AI + civic workflow assistance. CivicTrail provides informational and workflow assistance, not legal advice or legal representation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${condiment.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-navy text-cream">{children}</body>
    </html>
  );
}
