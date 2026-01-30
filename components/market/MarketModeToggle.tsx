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
  { value: "CBD", label: "CBD Market", description: "Non-intoxicating, fully public" },
  { value: "GATED", label: "Gated Market", description: "21+ verified, intoxicating" },
];

export default function MarketModeToggle() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { mode, setMode, isVerified, loadingVerification, refreshVerification } = useMarketMode();
  const [showModal, setShowModal] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);

  const handleSelect = async (next: MarketMode) => {
    if (next === "GATED" && !isVerified) {
      setShowModal(true);
      return;
    }
    setMode(next);
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
  };

  const handleStartVerification = async () => {
    setShowModal(false);
    await refreshVerification();
    router.push("/verify");
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Market Mode</p>
        <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)]/60 p-1">
          {OPTIONS.map((option) => {
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                disabled={loadingVerification || savingPreference}
                className={[
                  "px-4 py-2 rounded-full text-sm transition",
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
          {mode === "CBD" ? OPTIONS[0].description : OPTIONS[1].description}
        </p>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Gated market verification required"
        >
          <div className="card-glass p-6 max-w-md w-full border border-[var(--border)]">
            <h2 className="text-xl font-semibold text-accent mb-2">Gated Market is 21+</h2>
            <p className="text-sm text-muted mb-4">
              The gated market requires age verification and a government ID upload before you can
              browse or buy intoxicating products.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" className="btn-primary w-full" onClick={handleStartVerification}>
                Start Verification
              </button>
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => setShowModal(false)}
              >
                Stay in CBD Market
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
