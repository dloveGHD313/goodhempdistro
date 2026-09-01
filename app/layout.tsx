import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { preconnect } from "react-dom";
import localFont from "next/font/local";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import { validateEnvironmentVariables } from "@/lib/env-validator";
import { brand, colorVars } from "@/lib/brand";
import Nav from "@/components/Nav";
import AgeGate from "@/components/AgeGate";
import MascotGate from "@/components/mascot/MascotGate";
import DeferredLayoutMounts from "@/components/DeferredLayoutMounts";
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
    // Perf: dedicated small icons. The old config pointed both at the 2.2MB
    // master logo PNG, which every page downloaded as its favicon (the single
    // largest transfer on the site - ~78% of total page weight).
    icon: brand.iconPath,
    apple: brand.appleIconPath,
  },
  openGraph: {
    title: `${brand.name} - Premium Hemp Marketplace`,
    description: brand.description,
    url: brand.url,
    siteName: brand.name,
    images: [
      {
        url: brand.ogImagePath,
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
    images: [brand.ogImagePath],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeVars = colorVars as CSSProperties;

  // Perf round 2: warm the Supabase connection early — most pages fire
  // client-side Supabase/auth fetches right after hydration.
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) preconnect(new URL(supabaseUrl).origin, { crossOrigin: "anonymous" });
  } catch {
    // invalid URL — skip preconnect
  }

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
          <MascotGate />
          {/* Perf round 2: null-rendering gates + travel advisory are
              lazy-mounted after idle (see DeferredLayoutMounts). */}
          <DeferredLayoutMounts />
        </MarketModeProvider>
      </body>
    </html>
  );
}
