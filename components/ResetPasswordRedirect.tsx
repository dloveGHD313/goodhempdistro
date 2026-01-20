"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Client component that handles mis-redirects from Supabase
 * If Supabase redirects to site root with recovery tokens or errors in hash,
 * immediately redirect to /reset-password
 */
export default function ResetPasswordRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    // Only run on homepage (root path)
    if (pathname !== "/") {
      return;
    }

    // Check if hash contains recovery tokens or errors
    const hash = window.location.hash;
    if (!hash) {
      return;
    }

    const hasRecoveryToken = hash.includes("type=recovery") || hash.includes("access_token");
    const hasError = hash.includes("error_code=otp_expired") || hash.includes("error_code=access_denied");

    if (hasRecoveryToken || hasError) {
      console.log("[ResetPasswordRedirect] Detected recovery tokens/error in hash, redirecting to /reset-password");
      // Preserve hash when redirecting
      window.location.replace(`/reset-password${hash}`);
    }
  }, [pathname]);

  return null; // This component doesn't render anything
}
