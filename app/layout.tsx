import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { validateEnvironmentVariables } from "@/lib/env-validator";
import Nav from "@/components/Nav";
import AgeGateClient from "@/components/AgeGateClient";

// Validate environment variables at startup (logs warnings, doesn't throw)
if (typeof window === "undefined") {
  validateEnvironmentVariables({ logSuccess: false });
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Good Hemp Distros - Community Marketplace",
  description: "Community-driven hemp marketplace and social platform for verified vendors and customers",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Good Hemp Distros - Premium Hemp Marketplace",
    description: "Discover premium hemp products from verified vendors. Join our community.",
    url: "https://goodhempdistro.com",
    siteName: "Good Hemp Distros",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Good Hemp Distros",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Good Hemp Distros",
    description: "Premium hemp marketplace and community",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="topbar">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between w-full">
            <Nav />
          </div>
        </header>
        {children}
        <AgeGateClient />
      </body>
    </html>
  );
}
