"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export type MarketMode = "CBD_WELLNESS" | "INDUSTRIAL" | "SERVICES" | "INTOXICATING";

type MarketModeContextValue = {
  mode: MarketMode;
  setMode: (next: MarketMode) => void;
  isVerified: boolean;
  loadingVerification: boolean;
  refreshVerification: () => Promise<void>;
};

const MarketModeContext = createContext<MarketModeContextValue | null>(null);

const STORAGE_KEY = "ghd_market_mode";
const VALID_MODES: MarketMode[] = ["CBD_WELLNESS", "INDUSTRIAL", "SERVICES", "INTOXICATING"];

const normalizeMode = (value: string | null | undefined): MarketMode | null => {
  if (!value) return null;
  if (VALID_MODES.includes(value as MarketMode)) return value as MarketMode;
  if (value === "CBD") return "CBD_WELLNESS";
  if (value === "GATED") return "INTOXICATING";
  return null;
};

export function MarketModeProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setModeState] = useState<MarketMode>("CBD_WELLNESS");
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
        setLoadingVerification(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("age_verified, id_verification_status, market_mode_preference")
        .eq("id", user.id)
        .maybeSingle();

      const verified =
        profile?.age_verified === true &&
        (profile?.id_verification_status === "verified" ||
          profile?.id_verification_status === "approved");
      setIsVerified(verified);

      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored && profile?.market_mode_preference) {
          const preference = normalizeMode(profile.market_mode_preference);
          if (preference) {
            setModeState(preference);
            window.localStorage.setItem(STORAGE_KEY, preference);
          }
        }
      }
    } finally {
      setLoadingVerification(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const normalized = normalizeMode(stored);
    if (normalized) {
      setModeState(normalized);
    }
  }, []);

  useEffect(() => {
    refreshVerification();
  }, [refreshVerification]);

  const value = useMemo(
    () => ({ mode, setMode, isVerified, loadingVerification, refreshVerification }),
    [mode, setMode, isVerified, loadingVerification, refreshVerification]
  );

  return React.createElement(MarketModeContext.Provider, { value }, children);
}

export function useMarketMode() {
  const context = useContext(MarketModeContext);
  if (!context) {
    throw new Error("useMarketMode must be used within MarketModeProvider");
  }
  return context;
}
