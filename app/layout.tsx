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
  title: "Good Hemp Distro",
  description: "Community-driven hemp marketplace and social platform",
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
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <a href="/" className="text-xl font-bold flex items-center gap-2">
              <span>🌿</span>
              <span>Good Hemp Distro</span>
            </a>
            <Nav />
          </div>
        </header>
        {children}
        <AgeGateClient />
      </body>
    </html>
  );
}
