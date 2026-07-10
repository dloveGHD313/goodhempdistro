/**
 * US state normalization — canonical form is the 2-letter USPS code.
 *
 * P1 (storefront audit 2026-07-10): vendor rows carry inconsistent state
 * values ("TN", "tennessee", "michigan", "nashville"…) while consumer
 * profiles carry USPS codes. Exact-match comparisons silently drop vendors
 * (and their products) from Discover. Normalize BOTH sides before comparing.
 *
 * Data hygiene on vendors.state itself is a separate CEO-gated task (P2 in
 * the audit — production business data); this helper makes reads robust
 * regardless.
 */

import { STATE_NAMES } from "@/lib/compliance/stateNames";

// Full name (lowercased) → USPS code, derived from the existing SSOT map.
const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code]),
);

const VALID_CODES = new Set(Object.keys(STATE_NAMES));

/**
 * Normalize any state representation to a USPS code, or null when the
 * input isn't recognizable as a US state (e.g. a city name like
 * "nashville", empty string, null).
 *
 *   "TN" → "TN"; "tn " → "TN"; "Tennessee" → "TN"; "tennessee" → "TN";
 *   "nashville" → null; "" → null; null → null
 */
export function normalizeUsState(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && VALID_CODES.has(upper)) return upper;
  const byName = NAME_TO_CODE[trimmed.toLowerCase()];
  return byName ?? null;
}

/** True when both values normalize to the same USPS code (and neither is unrecognizable). */
export function sameUsState(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeUsState(a);
  const nb = normalizeUsState(b);
  return na !== null && na === nb;
}
