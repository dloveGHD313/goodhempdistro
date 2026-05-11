"use client";

import { useEffect, useState } from "react";

/**
 * AgeGate — warning model, not hard block.
 *
 * Renders a sticky top banner if the user has not yet acknowledged the 21+
 * age requirement. The underlying page still renders so search engines and
 * curious visitors can read marketing content. Users see the banner until
 * they click "I am 21+" (banner dismisses, cookie + localStorage stored for
 * 1 year) or "Under 21" (navigates to /come-back-later).
 *
 * Excluded paths (banner does not render): policy pages, the come-back-later
 * page itself, and any path under /api or /_next (those don't render React).
 */

const AGE_GATE_KEY = "ghd_age_verified";
const AGE_GATE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year

// Paths where the banner should NOT render. Infrastructure paths (/api, /_next,
// /sitemap.xml, /robots.txt) are never matched here because React never mounts.
const EXCLUDED_PATH_PREFIXES = [
  "/privacy",
  "/terms",
  "/contact",
  "/come-back-later",
];

function isAgeVerified(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(AGE_GATE_KEY);
    if (!stored) {
      // Fallback: also check the cookie in case localStorage was cleared
      return document.cookie.split(";").some((c) => c.trim().startsWith(`${AGE_GATE_KEY}=`));
    }
    const { verified, expiresAt } = JSON.parse(stored) as {
      verified?: boolean;
      expiresAt?: number;
    };
    if (!verified || typeof expiresAt !== "number" || Date.now() > expiresAt) {
      localStorage.removeItem(AGE_GATE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function setAgeVerified(): void {
  if (typeof window === "undefined") return;
  try {
    const expiresAt = Date.now() + AGE_GATE_MAX_AGE_SECONDS * 1000;
    localStorage.setItem(
      AGE_GATE_KEY,
      JSON.stringify({ verified: true, expiresAt }),
    );
    // Cookie value is a simple flag — the JSON shape stays in localStorage for
    // backward compatibility with components that may read the timestamp.
    const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
    document.cookie = `${AGE_GATE_KEY}=true; max-age=${AGE_GATE_MAX_AGE_SECONDS}; path=/; SameSite=Lax${isSecure ? "; Secure" : ""}`;
  } catch {
    // continue even if storage fails
  }
}

export default function AgeGate() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    function evaluate() {
      const pathname = window.location.pathname;
      if (EXCLUDED_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
        setShowBanner(false);
        return;
      }
      if (!isAgeVerified()) setShowBanner(true);
      else setShowBanner(false);
    }

    evaluate();

    window.addEventListener("popstate", evaluate);
    const origPush = history.pushState.bind(history);
    history.pushState = (...args) => {
      origPush(...args);
      evaluate();
    };

    return () => {
      window.removeEventListener("popstate", evaluate);
      history.pushState = origPush;
    };
  }, []);

  const handleVerify = () => {
    setAgeVerified();
    setShowBanner(false);
  };

  const handleDecline = () => {
    window.location.assign("/come-back-later");
  };

  if (!showBanner) return null;

  return (
    <div
      role="region"
      aria-label="Age verification notice"
      className="sticky top-0 z-[80] w-full border-b border-[#3CB97A]/30 bg-[#0D1512]/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-semibold text-[#F0EDE6]">
            You must be 21+ to purchase hemp products.
          </p>
          <p className="text-xs text-[#8A9E96]">
            Good Hemp Distro is a hemp marketplace for adults 21 and older.
            By selecting &quot;I am 21+&quot; you confirm you meet the minimum age
            requirement in your jurisdiction. State and local laws may further
            restrict access.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-shrink-0">
          <button
            type="button"
            onClick={handleVerify}
            className="rounded-lg bg-[#3CB97A] px-4 py-2 text-sm font-semibold text-[#0D1512] transition-opacity hover:opacity-90"
          >
            I am 21+
          </button>
          <button
            type="button"
            onClick={handleDecline}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-[#8A9E96] transition-colors hover:border-white/30 hover:text-[#F0EDE6]"
          >
            Under 21 — Come back later
          </button>
        </div>
      </div>
    </div>
  );
}
