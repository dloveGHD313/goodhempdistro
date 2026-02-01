/**
 * Single source of truth for market/category display and normalization.
 * All UI must show "Recreational" (never Intoxicating/Intoxicated/Psychoactive).
 * Internal value is RECREATIONAL; legacy INTOXICATING normalizes to RECREATIONAL.
 */

export type MarketCategory =
  | "CBD_WELLNESS"
  | "INDUSTRIAL"
  | "SERVICES"
  | "RECREATIONAL";

/** Legacy DB value; normalize to RECREATIONAL everywhere. */
export const LEGACY_INTOXICATING = "INTOXICATING" as const;

/** Canonical value for recreational/gated market. */
export const RECREATIONAL: MarketCategory = "RECREATIONAL";

/** Display labels for UI only. No Intoxicating/Intoxicated/Psychoactive. */
export const MARKET_DISPLAY_NAMES: Record<string, string> = {
  CBD_WELLNESS: "CBD & Wellness",
  INDUSTRIAL: "Industrial",
  SERVICES: "Services",
  RECREATIONAL: "Recreational",
  [LEGACY_INTOXICATING]: "Recreational",
};

/**
 * Normalize any market/category value to canonical form.
 * intoxicating, psychoactive, intoxicated, INTOXICATING → RECREATIONAL.
 */
export function normalizeMarket(
  value: string | null | undefined
): MarketCategory | null {
  if (value == null || value === "") return null;
  const v = value.trim();
  if (v === "CBD_WELLNESS" || v === "INDUSTRIAL" || v === "SERVICES") return v;
  if (
    v === "RECREATIONAL" ||
    v === "recreational" ||
    v === LEGACY_INTOXICATING ||
    v.toLowerCase() === "intoxicating" ||
    v.toLowerCase() === "psychoactive" ||
    v.toLowerCase() === "intoxicated"
  ) {
    return RECREATIONAL;
  }
  return null;
}

/**
 * Whether the value represents the recreational (gated) category.
 */
export function isRecreationalCategory(value: string | null | undefined): boolean {
  const normalized = normalizeMarket(value);
  return normalized === RECREATIONAL;
}

/**
 * Display label for a market value. Always "Recreational" for gated, never Intoxicating.
 */
export function getMarketDisplayName(value: string | null | undefined): string {
  const normalized = normalizeMarket(value);
  if (!normalized) return "Unknown";
  return MARKET_DISPLAY_NAMES[normalized] ?? MARKET_DISPLAY_NAMES[RECREATIONAL];
}

/**
 * For DB/API compatibility: accept RECREATIONAL or INTOXICATING, return value to store.
 * After migration to RECREATIONAL in DB, this can return value as-is when normalized === RECREATIONAL.
 */
export function toDbMarket(value: string | null | undefined): string | null {
  const n = normalizeMarket(value);
  if (!n) return null;
  return n;
}

/**
 * When reading from DB: map legacy INTOXICATING to RECREATIONAL for app use.
 */
export function fromDbMarket(value: string | null | undefined): MarketCategory | null {
  return normalizeMarket(value);
}
