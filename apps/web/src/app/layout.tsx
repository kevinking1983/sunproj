import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Providers } from "@/components/providers";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { LocationModal } from "@/components/location/LocationModal";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "RATION · Groceries in minutes", template: "%s · RATION" },
  description: "Fresh groceries and daily essentials delivered to your door in minutes.",
  applicationName: "RATION",
};

export const viewport: Viewport = { themeColor: "#123C2D", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 sm:px-6">{children}</main>
          <Footer />
          <CartDrawer />
          <LocationModal />
        </Providers>
      </body>
    </html>
  );
}
