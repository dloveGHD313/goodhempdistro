"use client";

import { useEffect } from "react";

/**
 * Global client component that handles Supabase recovery hash redirects
 * Renders in root layout to catch recovery tokens on ANY route
 * 
 * If Supabase redirects to any page with recovery tokens/errors in hash,
 * immediately redirects to /reset-password preserving the hash
 */
export default function RecoveryHashRedirect() {
  useEffect(() => {
    console.log("[recovery-redirect] mounted");
    
    // Check if hash contains recovery tokens or errors
    const hash = window.location.hash;
    console.log("[recovery-redirect] hash=", hash);
    
    if (!hash) {
      return;
    }

    // Check for recovery type AND tokens/errors
    const hasRecoveryType = hash.includes("type=recovery");
    const hasAccessToken = hash.includes("access_token");
    const hasError = hash.includes("error_code=otp_expired") || 
                     hash.includes("error_code=access_denied") ||
                     hash.includes("error=access_denied");

    // Only redirect if we have recovery type AND (tokens OR errors)
    if (hasRecoveryType && (hasAccessToken || hasError)) {
      const target = `/reset-password${hash}`;
      console.log("[recovery-redirect] redirecting to", target);
      // Preserve hash when redirecting - use replace to avoid back button issues
      window.location.replace(target);
    }
  }, []); // Run once on mount

  return null; // This component doesn't render anything
}
