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
