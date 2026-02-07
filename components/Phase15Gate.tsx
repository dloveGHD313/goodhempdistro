"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import useAuthUser from "@/components/engagement/useAuthUser";

const EXCLUDED_PATHS = [
  "/onboarding",
  "/welcome",
  "/signup",
  "/login",
  "/auth",
  "/reset-password",
];

/**
 * Phase 1.5: Redirect authenticated users to /onboarding if they haven't completed
 * the post-auth questionnaire. Does not run on excluded paths.
 */
export default function Phase15Gate() {
  const router = useRouter();
  const pathname = usePathname();
  const { userId, loading: authLoading } = useAuthUser();
  const didCheckRef = useRef(false);

  useEffect(() => {
    if (authLoading || !userId) return;
    if (didCheckRef.current) return;

    const excluded = EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (excluded) return;

    didCheckRef.current = true;

    fetch("/api/onboarding/status", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { completed?: boolean }) => {
        if (!data.completed) {
          router.replace("/onboarding");
        }
      })
      .catch(() => {
        didCheckRef.current = false;
      });
  }, [authLoading, userId, pathname, router]);

  return null;
}
