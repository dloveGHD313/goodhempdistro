"use client";

import { useEffect, useState } from "react";

// Pages where age gate should NOT appear
const EXCLUDED_PATHS = ["/privacy", "/terms", "/contact", "/welcome"];

const AGE_GATE_KEY = "ghd_age_verified";
const AGE_GATE_EXPIRY_DAYS = 30;

function isAgeVerified(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(AGE_GATE_KEY);
    if (!stored) return false;

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
    const expiresAt =
      Date.now() + AGE_GATE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      AGE_GATE_KEY,
      JSON.stringify({ verified: true, expiresAt }),
    );
    document.cookie = `ghd_age_verified=${JSON.stringify({
      verified: true,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    })}; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Lax`;
  } catch {
    // continue even if storage fails
  }
}

export default function AgeGate() {
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    function evaluate() {
      const pathname = window.location.pathname;
      if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) {
        setShowGate(false);
        return;
      }
      if (!isAgeVerified()) setShowGate(true);
    }

    evaluate(); // run on mount

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
    setShowGate(false);
  };

  const handleDecline = () => {
    window.location.assign("https://google.com");
  };

  if (!showGate) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
    >
      <div className="relative mx-4 max-w-md w-full rounded-2xl border border-white/10 bg-[#0D1512] p-8 text-center shadow-2xl">
        {/* Logo / Brand mark */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-[#3CB97A] mb-1">
            Good Hemp Distro
          </p>
          <div className="h-px w-16 bg-[#3CB97A]/40 mx-auto" />
        </div>

        <h2
          id="age-gate-title"
          className="text-2xl font-serif text-[#F0EDE6] mb-3"
        >
          You must be 21+ to enter
        </h2>

        <p className="text-sm text-[#8A9E96] mb-8 leading-relaxed">
          Good Hemp Distro is a hemp marketplace for adults 21 and older.
          By entering, you confirm you meet the minimum age requirement
          in your region.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleVerify}
            className="w-full rounded-lg bg-[#3CB97A] px-6 py-3 text-sm font-semibold text-[#0D1512] hover:opacity-90 transition-opacity"
          >
            I am 21 or older — Enter Site
          </button>
          <button
            onClick={handleDecline}
            className="w-full rounded-lg border border-white/10 px-6 py-3 text-sm text-[#8A9E96] hover:text-[#F0EDE6] hover:border-white/20 transition-colors"
          >
            I am under 21 — Exit
          </button>
        </div>

        <p className="mt-6 text-xs text-[#8A9E96]/60">
          This site contains hemp products. Must be 21+ to purchase.
          FDA disclaimer: These statements have not been evaluated by the
          FDA. Products are not intended to diagnose, treat, cure, or
          prevent any disease.
        </p>
      </div>
    </div>
  );
}
