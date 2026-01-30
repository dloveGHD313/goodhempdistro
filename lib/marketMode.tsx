"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export type MarketMode = "CBD" | "GATED";

type MarketModeContextValue = {
  mode: MarketMode;
  setMode: (next: MarketMode) => void;
  isVerified: boolean;
  loadingVerification: boolean;
  refreshVerification: () => Promise<void>;
};

const MarketModeContext = createContext<MarketModeContextValue | null>(null);

const STORAGE_KEY = "ghd_market_mode";

export function MarketModeProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setModeState] = useState<MarketMode>("CBD");
  const [isVerified, setIsVerified] = useState(false);
  const [loadingVerification, setLoadingVerification] = useState(true);

  const setMode = useCallback((next: MarketMode) => {
    setModeState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const refreshVerification = useCallback(async () => {
    setLoadingVerification(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsVerified(false);
        if (typeof window !== "undefined") {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored === "GATED") {
            setModeState("CBD");
            window.localStorage.setItem(STORAGE_KEY, "CBD");
          }
        }
        setLoadingVerification(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("age_verified, id_verification_status, market_mode_preference")
        .eq("id", user.id)
        .maybeSingle();

      const verified =
        profile?.age_verified === true && profile?.id_verification_status === "verified";
      setIsVerified(verified);

      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (
          !stored &&
          (profile?.market_mode_preference === "CBD" || profile?.market_mode_preference === "GATED")
        ) {
          setModeState(profile.market_mode_preference);
          window.localStorage.setItem(STORAGE_KEY, profile.market_mode_preference);
        }
        if (!verified && stored === "GATED") {
          setModeState("CBD");
          window.localStorage.setItem(STORAGE_KEY, "CBD");
        }
      }
    } finally {
      setLoadingVerification(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "CBD" || stored === "GATED") {
      setModeState(stored);
    }
  }, []);

  useEffect(() => {
    refreshVerification();
  }, [refreshVerification]);

  const value = useMemo(
    () => ({ mode, setMode, isVerified, loadingVerification, refreshVerification }),
    [mode, setMode, isVerified, loadingVerification, refreshVerification]
  );

  return <MarketModeContext.Provider value={value}>{children}</MarketModeContext.Provider>;
}

export function useMarketMode() {
  const context = useContext(MarketModeContext);
  if (!context) {
    throw new Error("useMarketMode must be used within MarketModeProvider");
  }
  return context;
}
