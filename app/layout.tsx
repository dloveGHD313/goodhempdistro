import type { Metadata } from "next";
import type { CSSProperties } from "react";
import localFont from "next/font/local";
import "./globals.css";
import { validateEnvironmentVariables } from "@/lib/env-validator";
import { brand, colorVars } from "@/lib/brand";
import Nav from "@/components/Nav";
import AgeGateClient from "@/components/AgeGateClient";
import RecoveryHashRedirect from "@/components/RecoveryHashRedirect";
import { logMascotFlagMismatch } from "@/lib/mascotFlags";
import MascotMountClient from "@/components/mascot/MascotMountClient";
import { MarketModeProvider } from "@/lib/marketMode";

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
  const { clientEnabled, serverEnabled } = logMascotFlagMismatch("layout");
  const mascotEnabled = clientEnabled && serverEnabled;

  return (
    <html lang="en" style={themeVars}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <MarketModeProvider>
          <div className="app-bg" aria-hidden="true" />
          <header className="topbar">
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between w-full">
              <Nav />
            </div>
          </header>
          {children}
          {mascotEnabled ? <MascotMountClient /> : null}
          <AgeGateClient />
          <RecoveryHashRedirect />
        </MarketModeProvider>
      </body>
    </html>
  );
}
