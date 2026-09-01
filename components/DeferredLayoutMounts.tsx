"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Perf round 2 (Phase 7.5): these root-layout mounts render nothing visible
// on first paint (null-returning gates + a fixed-position advisory that only
// appears after an API call), but each one shipped hydration JS on every
// page. They are now (a) excluded from SSR and the main bundle via
// `ssr: false`, and (b) mounted only after the browser goes idle, keeping
// hydration + main-thread work off the critical path.
const PersistWelcomeIntents = dynamic(() => import("@/components/PersistWelcomeIntents"), { ssr: false });
const Phase15Gate = dynamic(() => import("@/components/Phase15Gate"), { ssr: false });
const RecoveryHashRedirect = dynamic(() => import("@/components/RecoveryHashRedirect"), { ssr: false });
const TravelAdvisory = dynamic(() => import("@/components/TravelAdvisory"), { ssr: false });

export default function DeferredLayoutMounts() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // A Supabase auth-recovery hash must be handled immediately —
    // RecoveryHashRedirect is the component that consumes it.
    const hash = window.location.hash || "";
    if (hash.includes("access_token") || hash.includes("type=recovery") || hash.includes("error_code")) {
      const t = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(t);
    }
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;

  return (
    <>
      <PersistWelcomeIntents />
      <Phase15Gate />
      <TravelAdvisory />
      <RecoveryHashRedirect />
    </>
  );
}
