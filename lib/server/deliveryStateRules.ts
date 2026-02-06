import { createSupabaseServerClient } from "@/lib/supabase";

export type HempDeliveryStateRule = {
  state_code: string;
  delivery_allowed: boolean;
  in_person_only: boolean;
  intoxicating_hemp_allowed: boolean;
  citation_url: string | null;
  source_authority: string | null;
  last_verified_at: string | null;
};

/**
 * Fetch delivery rule for a state (2-letter code).
 * Returns null if state not in table or lookup fails.
 */
export async function getDeliveryStateRule(
  stateCode: string
): Promise<HempDeliveryStateRule | null> {
  const code =
    typeof stateCode === "string" ? stateCode.trim().toUpperCase().slice(0, 2) : "";
  if (!code || code.length !== 2) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hemp_delivery_state_rules")
    .select("state_code, delivery_allowed, in_person_only, intoxicating_hemp_allowed, citation_url, source_authority, last_verified_at")
    .eq("state_code", code)
    .maybeSingle();

  if (error || !data) return null;
  return data as HempDeliveryStateRule;
}

/**
 * Returns true only if state exists in table and delivery_allowed = true.
 */
export async function isDeliveryAllowedInState(stateCode: string): Promise<boolean> {
  const rule = await getDeliveryStateRule(stateCode);
  return rule?.delivery_allowed === true;
}
