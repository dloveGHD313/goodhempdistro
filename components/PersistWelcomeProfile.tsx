"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  getWelcomeProfile,
  clearWelcomeProfile,
} from "@/lib/phase0-storage";
import { getWelcomeDestination } from "@/lib/welcome-destination";
import useAuthUser from "@/components/engagement/useAuthUser";

const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/**
 * On first authenticated load, persists WelcomeProfile from localStorage to DB,
 * clears localStorage, and redirects to destination based on intents.
 * Runs once per session when conditions are met.
 */
export default function PersistWelcomeProfile() {
  const router = useRouter();
  const { userId, loading: authLoading } = useAuthUser();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (authLoading || !userId) return;
    if (didRunRef.current) return;
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
          const dest = getWelcomeDestination(intents);
          if (isDev) console.debug("[PersistWelcomeProfile] persisted, redirecting to", dest);
          router.replace(dest);
        } else if (isDev) {
          console.debug("[PersistWelcomeProfile] persist failed", res.status, data);
        }
      } catch (err) {
        if (isDev) console.debug("[PersistWelcomeProfile] error", err);
        didRunRef.current = false;
      }
    })();
  }, [authLoading, userId, pathname, router]);

  return null;
}
