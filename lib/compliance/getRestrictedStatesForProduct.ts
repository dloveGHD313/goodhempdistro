import type { SupabaseClient } from "@supabase/supabase-js";
import { ALL_US_STATES } from "./constants";

/**
 * Returns state codes where this product cannot be shipped based on
 * hemp_state_rules. Falls back to the seeded conservative list on DB error.
 *
 * If isIntoxicating || isGated, queries states where
 * allows_sale_intoxicating = false. Non-intoxicating products have no
 * state restrictions (returns []).
 */
export async function getRestrictedStatesForProduct(
  isIntoxicating: boolean,
  isGated: boolean,
  supabaseAdmin: SupabaseClient
): Promise<string[]> {
  if (!isIntoxicating && !isGated) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from("hemp_state_rules")
      .select("state_code")
      .eq("allows_sale_intoxicating", false);

    if (error) throw error;
    return (data ?? []).map((r: { state_code: string }) => r.state_code);
  } catch {
    // Fail-closed: fall back to conservative hardcoded list so restricted
    // states are never accidentally enabled when the DB is unreachable.
    const { RESTRICTED_STATES_FOR_INTOXICATING } = await import("./constants");
    return [...RESTRICTED_STATES_FOR_INTOXICATING];
  }
}

/**
 * Computes the allowed ship_to_states array for a product by removing
 * DB-restricted states from the full 51-jurisdiction default.
 */
export async function computeShipToStates(
  isIntoxicating: boolean,
  isGated: boolean,
  supabaseAdmin: SupabaseClient,
  vendorOverrides?: string[]
): Promise<string[]> {
  const restricted = await getRestrictedStatesForProduct(isIntoxicating, isGated, supabaseAdmin);
  const restrictedSet = new Set(restricted);

  const base = vendorOverrides ?? [...ALL_US_STATES];
  return base.filter((s) => !restrictedSet.has(s));
}
