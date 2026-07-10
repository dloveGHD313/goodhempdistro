/**
 * Per-vendor brand loyalty (perks spec 2026-07-10 §5).
 *
 * After BRAND_LOYALTY_ORDER_THRESHOLD (3) completed orders with one vendor,
 * the buyer unlocks their consumer-tier's brand level — Basic→Bronze 5%,
 * Plus→Silver 10%, Premium→Gold 15% — and a vendor-scoped brand coupon is
 * issued into consumer_coupons. Free tier follows only (no status).
 *
 * recordPaidOrderForBrandLoyalty is called from the paid webhook; it is
 * idempotent per order via the order_id-keyed loyalty event check in the
 * caller (purchase points) plus the metadata dedupe here.
 */

import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  BRAND_LOYALTY_ORDER_THRESHOLD,
  TIER_ENTITLEMENTS,
  resolveConsumerTier,
  type BrandLoyaltyTier,
} from "@/lib/entitlements";
import { generateCouponCode } from "@/lib/coupons";

/** 90-day validity for brand coupons (tunable). */
const BRAND_COUPON_VALIDITY_DAYS = 90;

export type BrandLoyaltyStatus = "None" | BrandLoyaltyTier;

/**
 * Decide the status a user unlocks at/after the order threshold.
 * Pure — unit-tested.
 */
export function brandStatusForTier(
  tier: keyof typeof TIER_ENTITLEMENTS,
  completedOrders: number
): BrandLoyaltyStatus {
  if (completedOrders < BRAND_LOYALTY_ORDER_THRESHOLD) return "None";
  const brand = TIER_ENTITLEMENTS[tier].brandLoyalty;
  return brand ? brand.tier : "None";
}

/**
 * Increment completed_orders for (user, vendor) on a paid order; unlock
 * status + issue the brand coupon when the threshold is crossed or the
 * user's tier-level improved since last unlock (e.g. upgraded to Premium).
 */
export async function recordPaidOrderForBrandLoyalty(params: {
  userId: string;
  vendorId: string;
  orderId: string;
}): Promise<void> {
  const { userId, vendorId, orderId } = params;
  const admin = getSupabaseAdminClient();

  try {
    // Dedupe per order: bail if this order already counted.
    const { data: counted } = await admin
      .from("consumer_loyalty_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_type", "brand_loyalty_order")
      .filter("metadata->>order_id", "eq", orderId)
      .maybeSingle();
    if (counted?.id) return;

    const { data: existing } = await admin
      .from("brand_loyalty")
      .select("id, completed_orders, status")
      .eq("user_id", userId)
      .eq("vendor_id", vendorId)
      .maybeSingle();

    const completedOrders = (existing?.completed_orders ?? 0) + 1;
    const tier = await resolveConsumerTier(userId);
    const newStatus = brandStatusForTier(tier, completedOrders);
    const currentStatus = (existing?.status ?? "None") as BrandLoyaltyStatus;
    const statusChanged = newStatus !== "None" && newStatus !== currentStatus;

    const row = {
      user_id: userId,
      vendor_id: vendorId,
      completed_orders: completedOrders,
      status: statusChanged ? newStatus : currentStatus,
      ...(statusChanged ? { unlocked_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error: upsertError } = await admin
      .from("brand_loyalty")
      .upsert(row, { onConflict: "user_id,vendor_id" });
    if (upsertError) {
      console.error("[brand-loyalty] upsert failed:", upsertError.message);
      return;
    }

    // Record the counted order (this is the idempotency anchor).
    await admin.rpc("consumer_loyalty_add_points", {
      p_user_id: userId,
      p_points: 0,
      p_event_type: "brand_loyalty_order",
      p_metadata: {
        order_id: orderId,
        vendor_id: vendorId,
        completed_orders: completedOrders,
        status: statusChanged ? newStatus : currentStatus,
      },
    });

    if (statusChanged) {
      const brand = TIER_ENTITLEMENTS[tier].brandLoyalty;
      if (brand) {
        const expiresAt = new Date(
          Date.now() + BRAND_COUPON_VALIDITY_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();
        const { error: couponError } = await admin.from("consumer_coupons").insert({
          user_id: userId,
          code: generateCouponCode(),
          percent_off: brand.percentOff,
          source: "vendor",
          vendor_id: vendorId,
          status: "active",
          expires_at: expiresAt,
          grant_key: `brand:${vendorId}:${brand.tier}`,
        });
        // 23505 on (user_id, grant_key): this brand level was already
        // rewarded for this vendor — expected on webhook replays.
        if (couponError && couponError.code !== "23505") {
          console.error("[brand-loyalty] coupon issue failed:", couponError.message);
        }
      }
    }
  } catch (err) {
    // Brand loyalty must never break order processing.
    console.error(
      "[brand-loyalty] recordPaidOrderForBrandLoyalty failed:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

/** Webhook convenience: resolve (user, vendor) from a paid order id. */
export async function recordBrandLoyaltyForOrder(orderId: string): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id, user_id, vendor_id, status")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.user_id || !order.vendor_id || order.status !== "paid") return;
    await recordPaidOrderForBrandLoyalty({
      userId: order.user_id,
      vendorId: order.vendor_id,
      orderId,
    });
  } catch (err) {
    console.error(
      "[brand-loyalty] recordBrandLoyaltyForOrder failed:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

/** Read a user's brand statuses (for profile/vendor-page badges). */
export async function getBrandLoyaltyStatuses(userId: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("brand_loyalty")
    .select("vendor_id, completed_orders, status, unlocked_at")
    .eq("user_id", userId);
  if (error) {
    console.error("[brand-loyalty] status read failed:", error.message);
    return [];
  }
  return data || [];
}
