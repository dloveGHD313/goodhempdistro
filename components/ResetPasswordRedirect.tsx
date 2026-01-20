"use client";

import { useEffect } from "react";

/**
 * Client component that handles mis-redirects from Supabase
 * If Supabase redirects to site root with recovery tokens or errors in hash,
 * immediately redirect to /reset-password
 * 
 * This runs on mount and checks window.location.hash directly
 */
export default function ResetPasswordRedirect() {
  useEffect(() => {
    console.log("[reset-redirect] mounted");
    
    // Check if hash contains recovery tokens or errors
    const hash = window.location.hash;
    console.log("[reset-redirect] hash=", hash);
    
    if (!hash) {
      return;
    }

    // Check for recovery tokens or errors
    const hasRecoveryToken = hash.includes("type=recovery") || 
                             hash.includes("access_token") || 
                             hash.includes("refresh_token");
    const hasError = hash.includes("error_code=otp_expired") || 
                     hash.includes("error_code=access_denied");

    if (hasRecoveryToken || hasError) {
      const target = `/reset-password${hash}`;
      console.log("[reset-redirect] redirecting to", target);
      // Preserve hash when redirecting - use replace to avoid back button issues
      window.location.replace(target);
    }
  }, []); // Run once on mount

  return null; // This component doesn't render anything
}
