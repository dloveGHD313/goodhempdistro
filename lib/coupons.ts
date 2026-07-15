/**
 * Member coupons — stacking rules + hard cap (perks spec 2026-07-10 §4).
 *
 * CEO decision 2026-07-10 (locked):
 * - Plus and Premium may stack EXACTLY one platform coupon + one vendor
 *   coupon on a single order. Free/Basic: one coupon max, no stacking.
 * - Hard cap: 25% off any single order, applied after all coupons. If
 *   stacked coupons exceed 25%, CLAMP the total discount to 25% — never
 *   reject the order. Enforced server-side at checkout.
 *
 * The pure functions here (selectApplicableCoupons, computeDiscountCents)
 * carry the money logic and are unit-tested; the DB helpers wrap them.
 */

import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  ORDER_DISCOUNT_CAP_PCT,
  TIER_ENTITLEMENTS,
  type ConsumerTier,
} from "@/lib/entitlements";

export type CouponRow = {
  id: string;
  code: string;
  percent_off: number;
  source: "platform" | "vendor";
  vendor_id: string | null;
  status: string;
  expires_at: string | null;
};

export type CouponSelection = {
  /** Coupons that will be applied (≤1 platform + ≤1 vendor). */
  applied: CouponRow[];
  /** Codes requested but not applied, with the reason. */
  rejected: Array<{ code: string; reason: string }>;
};

/**
 * Pick which of the user's requested coupons apply to this order.
 * - vendor coupons must match the order's vendor
 * - at most one coupon per source; extras are rejected (highest % wins)
 * - Free/Basic: one coupon total (highest % wins across sources)
 */
export function selectApplicableCoupons(params: {
  tier: ConsumerTier;
  coupons: CouponRow[];
  orderVendorId: string | null;
  now?: Date;
}): CouponSelection {
  const now = params.now ?? new Date();
  const rejected: CouponSelection["rejected"] = [];
  const valid: CouponRow[] = [];

  for (const coupon of params.coupons) {
    if (coupon.status !== "active") {
      rejected.push({ code: coupon.code, reason: "not_active" });
    } else if (coupon.expires_at && new Date(coupon.expires_at) <= now) {
      rejected.push({ code: coupon.code, reason: "expired" });
    } else if (
      coupon.source === "vendor" &&
      (!coupon.vendor_id || coupon.vendor_id !== params.orderVendorId)
    ) {
      rejected.push({ code: coupon.code, reason: "wrong_vendor" });
    } else {
      valid.push(coupon);
    }
  }

  const byPercentDesc = (a: CouponRow, b: CouponRow) => b.percent_off - a.percent_off;
  const platform = valid.filter((c) => c.source === "platform").sort(byPercentDesc);
  const vendor = valid.filter((c) => c.source === "vendor").sort(byPercentDesc);

  for (const extra of platform.slice(1)) {
    rejected.push({ code: extra.code, reason: "one_platform_coupon_max" });
  }
  for (const extra of vendor.slice(1)) {
    rejected.push({ code: extra.code, reason: "one_vendor_coupon_max" });
  }

  let applied = [platform[0], vendor[0]].filter(Boolean) as CouponRow[];

  const canStack = TIER_ENTITLEMENTS[params.tier].couponStacking;
  if (!canStack && applied.length > 1) {
    applied = [...applied].sort(byPercentDesc);
    for (const extra of applied.slice(1)) {
      rejected.push({ code: extra.code, reason: "stacking_requires_plus" });
    }
    applied = [applied[0]];
  }

  return { applied, rejected };
}

/**
 * Total discount in cents for the applied coupons against the PRODUCT
 * subtotal (delivery fees are never discounted). Percentages sum, then
 * clamp to the 25% order cap. Floor — never round a discount up.
 */
export function computeDiscountCents(
  productSubtotalCents: number,
  applied: Array<Pick<CouponRow, "percent_off">>
): { discountCents: number; effectivePct: number; capApplied: boolean } {
  if (productSubtotalCents <= 0 || applied.length === 0) {
    return { discountCents: 0, effectivePct: 0, capApplied: false };
  }
  const rawPct = applied.reduce((sum, c) => sum + c.percent_off, 0);
  const capApplied = rawPct > ORDER_DISCOUNT_CAP_PCT;
  const effectivePct = capApplied ? ORDER_DISCOUNT_CAP_PCT : rawPct;
  const discountCents = Math.floor((productSubtotalCents * effectivePct) / 100);
  return { discountCents, effectivePct, capApplied };
}

/** Fetch the user's own coupons by code (admin client; codes are per-user). */
export async function fetchUserCouponsByCodes(
  userId: string,
  codes: string[]
): Promise<CouponRow[]> {
  if (codes.length === 0) return [];
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("consumer_coupons")
    .select("id, code, percent_off, source, vendor_id, status, expires_at")
    .eq("user_id", userId)
    .in("code", codes);
  if (error) {
    console.error("[coupons] fetch failed:", error.message);
    return [];
  }
  return (data || []) as CouponRow[];
}

/** Mark coupons redeemed against an order (called from the paid webhook). */
export async function redeemCoupons(couponIds: string[], orderId: string) {
  if (couponIds.length === 0) return;
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("consumer_coupons")
    .update({ status: "redeemed", redeemed_order_id: orderId })
    .in("id", couponIds)
    .eq("status", "active");
  if (error) {
    console.error("[coupons] redeem failed:", error.message);
  }
}

/** Coupon code generator for grants: GHD-XXXXXXXX (unambiguous alphabet). */
export function generateCouponCode(prefix = "GHD"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const body = Array.from(
    { length: 8 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `${prefix}-${body}`;
}
