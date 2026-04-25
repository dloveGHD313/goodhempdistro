"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Pages where age gate should NOT appear
const EXCLUDED_PATHS = ["/privacy", "/terms", "/contact", "/welcome"];

const STORAGE_KEY = "ghd_age_verified";

export default function AgeGate() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show on excluded paths
    if (EXCLUDED_PATHS.some((p) => pathname?.startsWith(p))) return;

    // Don't show if already verified
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {
      // localStorage unavailable — show gate anyway (compliance required)
      setShow(true);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true);
  }, [pathname]);

  const handleConfirm = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
      document.cookie = "ghd_age_verified=true; path=/";
    } catch {
      // continue even if storage fails
    }
    setShow(false);
  };

  const handleDecline = () => {
    window.location.assign("https://google.com");
  };

  if (!show) return null;

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
            onClick={handleConfirm}
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
