"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useMarketMode, type MarketMode } from "@/lib/marketMode";

type Option = {
  value: MarketMode;
  label: string;
  description: string;
};

const OPTIONS: Option[] = [
  { value: "CBD_WELLNESS", label: "CBD & Wellness", description: "Non-intoxicating essentials" },
  { value: "INDUSTRIAL", label: "Industrial", description: "Hemp materials + supplies" },
  { value: "SERVICES", label: "Services", description: "Professional hemp services" },
  { value: "INTOXICATING", label: "Intoxicating", description: "21+ verified products" },
];

export default function MarketSwitcher() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { mode, setMode, isVerified, loadingVerification, refreshVerification } = useMarketMode();
  const [showModal, setShowModal] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);

  const handleSelect = async (next: MarketMode) => {
    setMode(next);
    if (next === "INTOXICATING" && !isVerified) {
      setShowModal(true);
    }
    setSavingPreference(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ market_mode_preference: next })
          .eq("id", user.id);
      }
    } finally {
      setSavingPreference(false);
    }

    if (next === "SERVICES") {
      router.push("/services");
    } else {
      router.push("/products");
    }
  };

  const handleStartVerification = async () => {
    setShowModal(false);
    await refreshVerification();
    router.push("/verify-age");
  };

  const handleStayInCbd = async () => {
    setShowModal(false);
    setMode("CBD_WELLNESS");
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ market_mode_preference: "CBD_WELLNESS" })
        .eq("id", user.id);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Market Switcher</p>
        <div className="inline-flex flex-wrap rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-1 gap-1">
          {OPTIONS.map((option) => {
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                disabled={loadingVerification || savingPreference}
                className={[
                  "px-4 py-2 rounded-xl text-sm transition",
                  active ? "bg-accent text-black" : "text-muted hover:text-white",
                  loadingVerification || savingPreference ? "opacity-70 cursor-wait" : "",
                ].join(" ")}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          {OPTIONS.find((option) => option.value === mode)?.description}
        </p>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Intoxicating market verification required"
        >
          <div className="card-glass p-6 max-w-md w-full border border-[var(--border)]">
            <h2 className="text-xl font-semibold text-accent mb-2">Intoxicating Market is 21+</h2>
            <p className="text-sm text-muted mb-4">
              The intoxicating market requires age verification and a government ID upload.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" className="btn-primary w-full" onClick={handleStartVerification}>
                Start Verification
              </button>
              <button type="button" className="btn-secondary w-full" onClick={handleStayInCbd}>
                Stay in CBD Market
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
