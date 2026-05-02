/**
 * Build 10: Ask JAX paid-plan eligibility.
 *
 * Tier mapping (priority: highest match wins):
 *   admin            → unlimited
 *   vendor_top       → unlimited
 *   vendor_mid       → 1000/mo
 *   vendor_starter   → 200/mo
 *   consumer         → 100/mo  (paid consumer, active affiliate)
 *   free             → 0       (gate hides widget; API returns 403)
 *
 * Affiliates and approved wholesale users are added to the paid set:
 *   - active affiliates       → consumer tier (100/mo)
 *   - approved wholesale apps → vendor_starter tier (200/mo)
 *     (wholesale customers are higher-value transactional users)
 *
 * TODO: differentiate consumer plans (basic / plus / pro) when the
 * consumer_plan_key enum is firmed up. Today the column is free-text
 * so we treat any active consumer subscription as the single
 * "consumer" tier with the 100/mo cap.
 */

import { getConsumerAccessStatus } from "@/lib/consumer-access";
import { getVendorAccessStatus } from "@/lib/vendor-access";
import { createSupabaseServerClient } from "@/lib/supabase";

export type JaxTier =
  | "free"
  | "consumer"
  | "vendor_starter"
  | "vendor_mid"
  | "vendor_top"
  | "admin";

export type JaxEligibility = {
  eligible: boolean;
  tier: JaxTier;
  /** null = unlimited */
  monthlyLimit: number | null;
};

export const JAX_TIER_LIMITS: Record<JaxTier, number | null> = {
  free: 0,
  consumer: 100,
  vendor_starter: 200,
  vendor_mid: 1000,
  vendor_top: null,
  admin: null,
};

const FREE: JaxEligibility = { eligible: false, tier: "free", monthlyLimit: 0 };

function tierToEligibility(tier: JaxTier): JaxEligibility {
  return {
    eligible: tier !== "free",
    tier,
    monthlyLimit: JAX_TIER_LIMITS[tier],
  };
}

/**
 * Resolve the JAX tier for the given user. Highest matching tier wins.
 * Returns FREE on any error so failures default to "no access" (safest).
 */
export async function getJaxEligibility(
  userId: string | null,
  userEmail: string | null
): Promise<JaxEligibility> {
  if (!userId) return FREE;

  try {
    const consumer = await getConsumerAccessStatus(userId, userEmail);
    if (consumer.isAdmin) return tierToEligibility("admin");

    const vendor = await getVendorAccessStatus(userId, userEmail);
    if (vendor.isAdmin) return tierToEligibility("admin");

    if (vendor.isSubscribed) {
      const tier = await readVendorTier(userId);
      if (tier === "top") return tierToEligibility("vendor_top");
      if (tier === "mid") return tierToEligibility("vendor_mid");
      return tierToEligibility("vendor_starter");
    }

    if (await isApprovedWholesale(userId)) return tierToEligibility("vendor_starter");

    if (consumer.isSubscribed) return tierToEligibility("consumer");
    if (await isActiveAffiliate(userId)) return tierToEligibility("consumer");

    return FREE;
  } catch {
    return FREE;
  }
}

async function readVendorTier(userId: string): Promise<"starter" | "mid" | "top"> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("vendors")
      .select("tier")
      .eq("owner_user_id", userId)
      .maybeSingle();
    const t = (data as { tier?: string } | null)?.tier;
    if (t === "top" || t === "mid" || t === "starter") return t;
    return "starter";
  } catch {
    return "starter";
  }
}

async function isActiveAffiliate(userId: string): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("affiliates")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    return (data as { status?: string } | null)?.status === "active";
  } catch {
    return false;
  }
}

async function isApprovedWholesale(userId: string): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("wholesale_applications")
      .select("status")
      .eq("user_id", userId)
      .eq("status", "approved")
      .maybeSingle();
    return (data as { status?: string } | null)?.status === "approved";
  } catch {
    return false;
  }
}
