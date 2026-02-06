"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Canonical driver application is now /logistics/apply (on-demand driver or provider listing).
 * This route redirects to unify the logistics funnel.
 */
export default function DriverApplyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/logistics/apply");
  }, [router]);

  return (
    <div className="min-h-screen text-white flex flex-col items-center justify-center">
      <p className="text-muted">Redirecting to logistics application...</p>
    </div>
  );
}
