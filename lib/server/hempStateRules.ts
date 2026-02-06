import { createSupabaseServerClient } from "@/lib/supabase";

export type HempStateRule = {
  state_code: string;
  allows_sale_non_intoxicating: boolean;
  allows_delivery_non_intoxicating: boolean;
  allows_sale_intoxicating: boolean;
  allows_delivery_intoxicating: boolean;
  notes: string | null;
  sources: unknown[];
  last_verified_at: string | null;
};

/**
 * Fetch state rule for a 2-letter state code. Returns null if not found.
 * Default-safe: caller should treat null as delivery not allowed, sale non-intoxicating allowed.
 */
export async function getHempStateRule(stateCode: string): Promise<HempStateRule | null> {
  const code =
    typeof stateCode === "string" ? stateCode.trim().toUpperCase().slice(0, 2) : "";
  if (!code || code.length !== 2) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hemp_state_rules")
    .select("state_code, allows_sale_non_intoxicating, allows_delivery_non_intoxicating, allows_sale_intoxicating, allows_delivery_intoxicating, notes, sources, last_verified_at")
    .eq("state_code", code)
    .maybeSingle();

  if (error || !data) return null;
  return data as HempStateRule;
}

/**
 * Default-safe when no rule: delivery DENIED.
 * With rule: use state's allows_delivery_* for the category.
 */
export function isDeliveryAllowedForCategory(rule: HempStateRule | null, isIntoxicating: boolean): boolean {
  if (!rule) return false;
  return isIntoxicating ? rule.allows_delivery_intoxicating : rule.allows_delivery_non_intoxicating;
}

/**
 * Default when no rule: sale ALLOWED (business requirement).
 * With rule: use state's allows_sale_* for the category.
 */
export function isSaleAllowedForCategory(rule: HempStateRule | null, isIntoxicating: boolean): boolean {
  if (!rule) return true;
  return isIntoxicating ? rule.allows_sale_intoxicating : rule.allows_sale_non_intoxicating;
}
