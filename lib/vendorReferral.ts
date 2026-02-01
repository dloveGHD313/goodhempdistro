/**
 * Vendor referral code (vr=) — capture and read for vendor signup attribution.
 */

const VENDOR_REF_COOKIE = "ghd_vendor_ref";
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export function captureVendorReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const vr = params.get("vr");
    if (vr && /^[A-Za-z0-9\-]+$/.test(vr)) {
      document.cookie = `${VENDOR_REF_COOKIE}=${encodeURIComponent(vr)}; max-age=${MAX_AGE}; path=/; SameSite=Lax`;
      return vr;
    }
  } catch (e) {
    console.warn("Failed to capture vendor referral code:", e);
  }
  return null;
}

export function getVendorReferralCode(): string | null {
  if (typeof document === "undefined") return null;
  try {
    for (const cookie of document.cookie.split(";")) {
      const [name, value] = cookie.trim().split("=");
      if (name === VENDOR_REF_COOKIE && value) {
        return decodeURIComponent(value);
      }
    }
  } catch (e) {
    console.warn("Failed to read vendor referral code:", e);
  }
  return null;
}

export function clearVendorReferralCode(): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${VENDOR_REF_COOKIE}=; max-age=0; path=/`;
  } catch {}
}
