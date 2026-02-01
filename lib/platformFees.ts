/**
 * Compute and persist platform_fee_cents and vendor_net_cents for order_items when order is paid.
 * Uses admin client; call from webhook after marking order paid.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type OrderItemRow = {
  id: string;
  item_type: string;
  line_total_cents: number | null;
  vendor_user_id: string | null;
};

type FeeRuleRow = {
  vendor_plan_type: string;
  item_type: string;
  fee_bps: number;
};

export async function applyPlatformFeesToOrder(
  admin: SupabaseClient,
  orderId: string
): Promise<{ error: Error | null }> {
  try {
    const { data: items, error: itemsError } = await admin
      .from("order_items")
      .select("id, item_type, line_total_cents, vendor_user_id")
      .eq("order_id", orderId);

    if (itemsError || !items?.length) {
      return { error: itemsError ? new Error(itemsError.message) : null };
    }

    const { data: rules, error: rulesError } = await admin
      .from("platform_fee_rules")
      .select("vendor_plan_type, item_type, fee_bps")
      .eq("active", true);

    if (rulesError) {
      return { error: new Error(rulesError.message) };
    }

    const ruleMap = new Map<string, number>();
    for (const r of rules || []) {
      ruleMap.set(`${(r as FeeRuleRow).vendor_plan_type}:${(r as FeeRuleRow).item_type}`, (r as FeeRuleRow).fee_bps);
    }

    const vendorUserIds = [...new Set((items as OrderItemRow[]).map((i) => i.vendor_user_id).filter(Boolean))] as string[];
    const { data: vendors } = await admin
      .from("vendors")
      .select("owner_user_id, tier, subscription_plan_key")
      .in("owner_user_id", vendorUserIds);

    const vendorPlanMap = new Map<string, string>();
    for (const v of vendors || []) {
      const plan = (v as { subscription_plan_key?: string; tier?: string }).subscription_plan_key
        || (v as { tier?: string }).tier
        || "default";
      vendorPlanMap.set((v as { owner_user_id: string }).owner_user_id, String(plan).toLowerCase());
    }

    for (const item of items as OrderItemRow[]) {
      const lineTotal = item.line_total_cents ?? 0;
      if (lineTotal <= 0) continue;

      const planType = item.vendor_user_id ? (vendorPlanMap.get(item.vendor_user_id) || "default") : "default";
      const itemType = item.item_type || "product";
      const key = `${planType}:${itemType}`;
      let feeBps = ruleMap.get(key) ?? ruleMap.get(`default:${itemType}`) ?? 0;

      const platformFeeCents = Math.floor((lineTotal * feeBps) / 10000);
      const vendorNetCents = lineTotal - platformFeeCents;

      await admin
        .from("order_items")
        .update({ platform_fee_cents: platformFeeCents, vendor_net_cents: vendorNetCents })
        .eq("id", item.id);
    }

    return { error: null };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return { error: err };
  }
}
