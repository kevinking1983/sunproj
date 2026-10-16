import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Shell } from "@/components/shell";

import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = { title: { default: "RATION Admin", template: "%s · RATION Admin" }, robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-ivory"><Shell>{children}</Shell></body>
    </html>
  );
}
