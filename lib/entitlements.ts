/**
 * Consumer tier entitlements — single source of truth.
 *
 * Built from GHD-CONSUMER-TIER-PERKS-SPEC-2026-07-10. Every consumer perk
 * (points multipliers, bonuses, coupons, JAX early access, event perks,
 * brand loyalty) reads from TIER_ENTITLEMENTS via resolveConsumerTier.
 * All numbers here are CEO-tunable defaults: tuning is a one-file change,
 * no logic edits.
 *
 * Tier mapping: paid tiers come from an ACTIVE consumer_subscriptions row
 * (subscription_status in active/trialing), keyed by consumer_plan_key
 * prefix. Higher tier ⊇ lower tier.
 */

// This module is PURE (no server imports) so client components can render
// the perk matrix. Tier resolution from the DB lives in
// lib/server/consumerTier.ts.

export type ConsumerTier = "Free" | "Basic" | "Plus" | "Premium";

export type BrandLoyaltyTier = "Bronze" | "Silver" | "Gold";

export type TierEntitlements = {
  /** Multiplies calculatePurchasePoints on paid orders. */
  pointsMultiplier: number;
  /** Bonus points on subscription start + each renewal. */
  subscriptionBonusPoints: number;
  /** Points per successful referral signup. */
  referralRewardPoints: number;
  /** Multiplies referral points/payouts the referrer earns. */
  referralEarnMultiplier: number;
  /** Platform member coupons granted per month; null = none. */
  monthlyCoupons: { count: number; percentOff: number } | null;
  /** May stack one platform + one vendor coupon on a single order. */
  couponStacking: boolean;
  /** Hours before public release that JAX content unlocks. 0 = public. */
  jaxEarlyAccessHours: number;
  /** Sees members_only JAX episodes + full archive. */
  jaxMembersOnly: boolean;
  /** Percent off event tickets. */
  eventTicketDiscountPct: number;
  /** Hours before public on-sale that ticket sales open. */
  eventEarlyAccessHours: number;
  /** Free community-event tickets per quarter. */
  freeEventTicketsPerQuarter: number;
  /** Brand loyalty level unlocked after the order threshold; null = follow only. */
  brandLoyalty: { tier: BrandLoyaltyTier; percentOff: number } | null;
  prioritySupport: boolean;
};

/** Completed orders with one vendor required to unlock brand-loyalty status. */
export const BRAND_LOYALTY_ORDER_THRESHOLD = 3;

/**
 * Hard cap on total discount for any single order, applied after all
 * coupons — CEO decision 2026-07-10. Clamp, never reject. Enforced
 * server-side at checkout.
 */
export const ORDER_DISCOUNT_CAP_PCT = 25;

export const TIER_ENTITLEMENTS: Record<ConsumerTier, TierEntitlements> = {
  Free: {
    pointsMultiplier: 1.0,
    subscriptionBonusPoints: 0,
    referralRewardPoints: 100,
    referralEarnMultiplier: 1.0,
    monthlyCoupons: null,
    couponStacking: false,
    jaxEarlyAccessHours: 0,
    jaxMembersOnly: false,
    eventTicketDiscountPct: 0,
    eventEarlyAccessHours: 0,
    freeEventTicketsPerQuarter: 0,
    brandLoyalty: null,
    prioritySupport: false,
  },
  Basic: {
    pointsMultiplier: 1.25,
    subscriptionBonusPoints: 500,
    referralRewardPoints: 250,
    referralEarnMultiplier: 1.25,
    monthlyCoupons: { count: 1, percentOff: 5 },
    couponStacking: false,
    jaxEarlyAccessHours: 24,
    jaxMembersOnly: false,
    eventTicketDiscountPct: 5,
    eventEarlyAccessHours: 0,
    freeEventTicketsPerQuarter: 0,
    brandLoyalty: { tier: "Bronze", percentOff: 5 },
    prioritySupport: false,
  },
  Plus: {
    pointsMultiplier: 1.5,
    subscriptionBonusPoints: 1000,
    referralRewardPoints: 500,
    referralEarnMultiplier: 1.5,
    monthlyCoupons: { count: 2, percentOff: 10 },
    couponStacking: true,
    jaxEarlyAccessHours: 72,
    jaxMembersOnly: false,
    eventTicketDiscountPct: 10,
    eventEarlyAccessHours: 24,
    freeEventTicketsPerQuarter: 0,
    brandLoyalty: { tier: "Silver", percentOff: 10 },
    prioritySupport: true,
  },
  Premium: {
    pointsMultiplier: 2.0,
    subscriptionBonusPoints: 2000,
    referralRewardPoints: 1000,
    referralEarnMultiplier: 2.0,
    monthlyCoupons: { count: 4, percentOff: 15 },
    couponStacking: true,
    jaxEarlyAccessHours: 168,
    jaxMembersOnly: true,
    eventTicketDiscountPct: 20,
    eventEarlyAccessHours: 48,
    freeEventTicketsPerQuarter: 1,
    brandLoyalty: { tier: "Gold", percentOff: 15 },
    prioritySupport: true,
  },
};

/**
 * Map a consumer_plan_key to its tier by prefix. Unknown/null keys are
 * Free — a stale or malformed plan key must never grant paid perks, and
 * must never break a checkout or webhook path.
 */
export function planKeyToTier(planKey: string | null | undefined): ConsumerTier {
  if (!planKey) return "Free";
  if (planKey.startsWith("consumer_starter_")) return "Basic";
  if (planKey.startsWith("consumer_plus_")) return "Plus";
  if (planKey.startsWith("consumer_vip_")) return "Premium";
  return "Free";
}

export function getTierEntitlements(tier: ConsumerTier): TierEntitlements {
  return TIER_ENTITLEMENTS[tier];
}

