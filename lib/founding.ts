/**
 * Founding Members program — client-safe constants and pure helpers.
 * Server-side claim/activation lives in lib/server/founding.ts.
 *
 * The offer (CEO, 2026-09-24): the first 100 founding members get a FULL YEAR of
 * the Vendor Enterprise (VIP) plan free. They pick monthly or annual billing and put
 * a card on file now (Stripe Checkout, 365-day trial); nothing is charged until the
 * free year ends, then the Enterprise subscription bills at the cadence they chose.
 *
 * Funnel: /founding (landing) → /founding/go?ref=<source> sets a cookie and sends the
 * visitor to sign up (signed-in visitors skip straight on) → the cookie is redeemed
 * on the first authenticated hop (auth callback / post-login-route), which records
 * the visit as a PENDING founding row → back on /founding they choose monthly or
 * annual → Stripe Checkout with the trial → the webhook (or the success page's
 * status check) ACTIVATES the row and assigns the founding number.
 */

export const FOUNDING_CAP = 100;
export const FOUNDING_TRIAL_DAYS = 365;

/**
 * Commission on founding members' sales during their free year (CEO, 2026-09-25).
 * Vendors who skip the trial and pay for Enterprise directly keep the regular Enterprise rate (1%).
 */
export const FOUNDING_COMMISSION_PERCENT = 10;
export const FOUNDING_COMMISSION_BPS = FOUNDING_COMMISSION_PERCENT * 100;

/** Cookie carrying the funnel visit through sign-up. Value: "<kind>|<source>". */
export const FOUNDING_COOKIE = "ghd_founding";
export const FOUNDING_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type FoundingKind = "vendor" | "member";
export type FoundingStatus = "pending" | "active" | "canceled";
export type FoundingInterval = "month" | "year";

/** The plans a founding member may choose (Vendor Enterprise only). */
export const FOUNDING_PLAN_KEYS: Record<FoundingInterval, string> = {
  month: "vendor_enterprise_monthly",
  year: "vendor_enterprise_annual",
};

export function isFoundingKind(value: unknown): value is FoundingKind {
  return value === "vendor" || value === "member";
}

export function isFoundingInterval(value: unknown): value is FoundingInterval {
  return value === "month" || value === "year";
}

/** Accepts month/monthly/year/annual/yearly. */
export function normalizeFoundingInterval(value: unknown): FoundingInterval | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "month" || v === "monthly") return "month";
  if (v === "year" || v === "annual" || v === "yearly") return "year";
  return null;
}

export function isFoundingPlanKey(planKey: unknown): boolean {
  return planKey === FOUNDING_PLAN_KEYS.month || planKey === FOUNDING_PLAN_KEYS.year;
}

/** Sanitise a ?ref= source tag for storage (letters, digits, dash, underscore; max 64). */
export function normalizeFoundingSource(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
  return cleaned.length > 0 ? cleaned : null;
}

export function encodeFoundingCookie(kind: FoundingKind | null, source: string | null): string {
  return `${kind ?? ""}|${source ?? ""}`;
}

export function decodeFoundingCookie(
  value: string | null | undefined
): { kind: FoundingKind | null; source: string | null } | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 96) return null;
  const [rawKind, rawSource = ""] = value.split("|");
  return {
    kind: isFoundingKind(rawKind) ? rawKind : null,
    source: normalizeFoundingSource(rawSource),
  };
}

/** "#007" */
export function formatFoundingNumber(n: number): string {
  return `#${String(n).padStart(3, "0")}`;
}

export function foundingSpotsClaimed(remaining: number): number {
  return Math.min(FOUNDING_CAP, Math.max(0, FOUNDING_CAP - remaining));
}

/** The date the free year ends (first charge) if the trial starts `from`. */
export function foundingFirstChargeDate(from: Date = new Date()): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + FOUNDING_TRIAL_DAYS);
  return d;
}

export function formatFoundingDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const t = typeof value === "string" ? Date.parse(value) : value.getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** What a founding member gets (Vendor Enterprise (VIP) for a year, then the plan they picked). */
export const FOUNDING_PERKS = [
  "A full year of Vendor Enterprise (VIP) — free",
  `Unlimited products, ${FOUNDING_COMMISSION_PERCENT}% commission during your free year, direct messaging with customers, VIP placement`,
  "$0 today: pick monthly or annual, card on file, first charge after the free year",
  "Your founding number (1–100) on your storefront, permanently",
] as const;
