/** Founding-vendor comp helpers (free N months without a Stripe subscription). */

/** Entitlements a comped founding vendor gets when they have no Stripe plan (Starter: 10 products, 7%). */
export const COMP_DEFAULT_PLAN_KEY = "vendor_starter_annual";

/** Max comp window an admin can grant in one shot (founding-vendor free year = 12). */
export const MAX_COMP_MONTHS = 24;

/** Returns an ISO timestamp `months` calendar months from `from`, or null when not requested / invalid. */
export function computeCompUntil(months: unknown, from: Date = new Date()): string | null {
  const n = typeof months === "number" ? months : Number.parseInt(String(months ?? ""), 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  const capped = Math.min(n, MAX_COMP_MONTHS);
  const d = new Date(from.getTime());
  d.setUTCMonth(d.getUTCMonth() + capped);
  return d.toISOString();
}

/** True while a comp window is open (mirrors isVendorActive.isCompActive; kept here so client-safe code can share it). */
export function isCompWindowOpen(compUntil: string | null | undefined, now: Date = new Date()): boolean {
  if (!compUntil) return false;
  const t = Date.parse(compUntil);
  return Number.isFinite(t) && t > now.getTime();
}

/** Human date for banners: "Sep 2, 2027" (UTC, so server and client agree). */
export function formatCompUntil(compUntil: string | null | undefined): string | null {
  if (!compUntil) return null;
  const t = Date.parse(compUntil);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export type CompCheckoutBlock = { compUntil: string; until: string; message: string };

/**
 * Founding-vendor guard for paid vendor checkout. Returns a block (409 payload) while the
 * comp window is open, null otherwise. A comped vendor must never be charged during the free year.
 */
export function compedCheckoutBlock(compUntil: string | null | undefined, now: Date = new Date()): CompCheckoutBlock | null {
  if (!isCompWindowOpen(compUntil, now)) return null;
  const until = formatCompUntil(compUntil) ?? "";
  return {
    compUntil: compUntil as string,
    until,
    message: `Your founding-vendor plan is free until ${until} — no subscription needed. We'll remind you before it ends.`,
  };
}
