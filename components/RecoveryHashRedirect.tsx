"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Global client component that handles Supabase recovery hash redirects
 * Renders in root layout to catch recovery tokens on ANY route
 * 
 * If Supabase redirects to any page with recovery tokens/errors in hash,
 * immediately redirects to /reset-password preserving the hash EXACTLY
 */
export default function RecoveryHashRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    
    console.log("[recovery-redirect] mounted path=", path, "hash=", hash);
    
    // Don't redirect if already on reset-password page
    if (path === "/reset-password") {
      return;
    }
    
    if (!hash) {
      return;
    }

    // Check for recovery type AND tokens/errors
    const hasRecoveryType = hash.includes("type=recovery");
    const hasAccessToken = hash.includes("access_token=");
    const hasError = hash.includes("error_code=otp_expired") || 
                     hash.includes("error_code=access_denied") ||
                     hash.includes("error=access_denied");

    // Only redirect if we have recovery type AND (tokens OR errors)
    if (hasRecoveryType && (hasAccessToken || hasError)) {
      // Preserve hash EXACTLY as-is
      const target = `/reset-password${hash}`;
      console.log("[recovery-redirect] redirecting to", target);
      // Use replace to avoid back button issues
      window.location.replace(target);
    }
  }, [pathname]); // Re-run if pathname changes

  return null; // This component doesn't render anything
}
