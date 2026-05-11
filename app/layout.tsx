import type { Metadata } from "next";
import type { CSSProperties } from "react";
import localFont from "next/font/local";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import { validateEnvironmentVariables } from "@/lib/env-validator";
import { brand, colorVars } from "@/lib/brand";
import Nav from "@/components/Nav";
import AgeGate from "@/components/AgeGate";
import RecoveryHashRedirect from "@/components/RecoveryHashRedirect";
import MascotGate from "@/components/mascot/MascotGate";
import PersistWelcomeIntents from "@/components/PersistWelcomeIntents";
import Phase15Gate from "@/components/Phase15Gate";
import TravelAdvisory from "@/components/TravelAdvisory";
import { MarketModeProvider } from "@/lib/marketMode";
import { MotionProvider, PageTransition } from "@/components/motion";

// Validate environment variables at startup (logs warnings, doesn't throw)
if (typeof window === "undefined") {
  validateEnvironmentVariables({ logSuccess: false });
}

const geistSans = localFont({
  variable: "--font-geist-sans",
  src: [
    {
      path: "../public/fonts/Geist-Variable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  display: "swap",
});





const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [
    {
      path: "../public/fonts/GeistMono-Variable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${brand.name} - Community Marketplace`,
  description: brand.description,
  icons: {
    icon: brand.logoPath,
    apple: brand.logoPath,
  },
  openGraph: {
    title: `${brand.name} - Premium Hemp Marketplace`,
    description: brand.description,
    url: brand.url,
    siteName: brand.name,
    images: [
      {
        url: brand.logoPath,
        width: brand.ogImageWidth,
        height: brand.ogImageHeight,
        alt: brand.name,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: brand.name,
    description: brand.description,
    images: [brand.logoPath],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeVars = colorVars as CSSProperties;

  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`} style={themeVars}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <MarketModeProvider>
          {/* AgeGate is mounted FIRST so its sticky natural-flow position
              is above the fold. Without this, first-time visitors don't
              see the 21+ warning until they scroll. Codex P1 from PR #173. */}
          <AgeGate />
          <div className="app-bg" aria-hidden="true" />
          <MotionProvider>
            <header className="topbar">
              <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between w-full">
                <Nav />
              </div>
            </header>
            <PageTransition>
              {children}
            </PageTransition>
          </MotionProvider>
          <PersistWelcomeIntents />
          <Phase15Gate />
          <MascotGate />
          <TravelAdvisory />
          <RecoveryHashRedirect />
        </MarketModeProvider>
      </body>
    </html>
  );
}
