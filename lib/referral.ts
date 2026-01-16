/**
 * Referral Cookie Utilities
 * Capture and manage affiliate referral codes via query params
 */

const REFERRAL_COOKIE_NAME = "ghd_affiliate_ref";
const REFERRAL_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Extract and store referral code from ?ref= query parameter
 * Should be called on page load (client-side)
 */
export function captureReferralCode() {
  if (typeof window === "undefined") return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");

    if (refCode && /^[A-Z0-9\-]+$/.test(refCode)) {
      // Store in cookie (7 days)
      document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(refCode)}; max-age=${REFERRAL_COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
      return refCode;
    }
  } catch (error) {
    console.warn("Failed to capture referral code:", error);
  }

  return null;
}

/**
 * Retrieve stored referral code from cookie
 */
export function getReferralCode(): string | null {
  if (typeof document === "undefined") return null;

  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === REFERRAL_COOKIE_NAME && value) {
        return decodeURIComponent(value);
      }
    }
  } catch (error) {
    console.warn("Failed to retrieve referral code:", error);
  }

  return null;
}

/**
 * Clear referral cookie (on successful signup)
 */
export function clearReferralCode() {
  if (typeof document === "undefined") return;

  try {
    document.cookie = `${REFERRAL_COOKIE_NAME}=; max-age=0; path=/`;
  } catch (error) {
    console.warn("Failed to clear referral code:", error);
  }
}
