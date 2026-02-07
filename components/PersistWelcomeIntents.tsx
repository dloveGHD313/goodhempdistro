"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getWelcomeProfile, clearWelcomeProfile } from "@/lib/phase0-storage";
import useAuthUser from "@/components/engagement/useAuthUser";

const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/**
 * On first authenticated load after signup/login, persists WelcomeProfile from
 * localStorage to profiles.welcome_intents, clears localStorage, routes to /onboarding.
 * Does not run on /welcome; uses ref guard to avoid re-runs.
 */
export default function PersistWelcomeIntents() {
  const router = useRouter();
  const pathname = usePathname();
  const { userId, loading: authLoading } = useAuthUser();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (authLoading || !userId) return;
    if (didRunRef.current) return;
    if (pathname?.startsWith("/welcome")) return;
    if (typeof window === "undefined") return;

    const profile = getWelcomeProfile();
    if (!profile?.intents?.length) return;

    didRunRef.current = true;
    const intents = profile.intents;

    (async () => {
      try {
        const res = await fetch("/api/welcome/persist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intents }),
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean };

        if (data.ok) {
          clearWelcomeProfile();
          if (isDev) console.debug("[PersistWelcomeIntents] persisted, redirecting to /onboarding");
          router.replace("/onboarding");
        } else if (isDev) {
          console.debug("[PersistWelcomeIntents] persist failed", res.status, data);
        }
      } catch (err) {
        if (isDev) console.debug("[PersistWelcomeIntents] error", err);
        didRunRef.current = false;
      }
    })();
  }, [authLoading, userId, pathname, router]);

  return null;
}
