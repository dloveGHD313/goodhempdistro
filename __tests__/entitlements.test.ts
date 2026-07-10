import { describe, expect, it } from "vitest";
import {
  BRAND_LOYALTY_ORDER_THRESHOLD,
  ORDER_DISCOUNT_CAP_PCT,
  TIER_ENTITLEMENTS,
  planKeyToTier,
  type ConsumerTier,
} from "@/lib/entitlements";
import { LOYALTY_MULTIPLIERS, REFERRAL_REWARD_POINTS } from "@/lib/consumer-loyalty";

const TIERS: ConsumerTier[] = ["Free", "Basic", "Plus", "Premium"];

describe("planKeyToTier", () => {
  it("maps consumer_plan_key prefixes to tiers", () => {
    expect(planKeyToTier("consumer_starter_monthly")).toBe("Basic");
    expect(planKeyToTier("consumer_starter_annual")).toBe("Basic");
    expect(planKeyToTier("consumer_plus_monthly")).toBe("Plus");
    expect(planKeyToTier("consumer_plus_annual")).toBe("Plus");
    expect(planKeyToTier("consumer_vip_monthly")).toBe("Premium");
    expect(planKeyToTier("consumer_vip_annual")).toBe("Premium");
  });

  it("fails closed to Free on null/unknown keys", () => {
    expect(planKeyToTier(null)).toBe("Free");
    expect(planKeyToTier(undefined)).toBe("Free");
    expect(planKeyToTier("")).toBe("Free");
    expect(planKeyToTier("vendor_pro_monthly")).toBe("Free");
    expect(planKeyToTier("consumer_mystery_monthly")).toBe("Free");
  });
});

describe("TIER_ENTITLEMENTS matrix (spec 2026-07-10 defaults)", () => {
  it("points multipliers: 1.0 / 1.25 / 1.5 / 2.0", () => {
    expect(TIER_ENTITLEMENTS.Free.pointsMultiplier).toBe(1.0);
    expect(TIER_ENTITLEMENTS.Basic.pointsMultiplier).toBe(1.25);
    expect(TIER_ENTITLEMENTS.Plus.pointsMultiplier).toBe(1.5);
    expect(TIER_ENTITLEMENTS.Premium.pointsMultiplier).toBe(2.0);
  });

  it("subscription bonus: 0 / 500 / 1000 / 2000", () => {
    expect(TIERS.map((t) => TIER_ENTITLEMENTS[t].subscriptionBonusPoints)).toEqual([
      0, 500, 1000, 2000,
    ]);
  });

  it("referral rewards: 100 / 250 / 500 / 1000 with matching earn multipliers", () => {
    expect(TIERS.map((t) => TIER_ENTITLEMENTS[t].referralRewardPoints)).toEqual([
      100, 250, 500, 1000,
    ]);
    expect(TIERS.map((t) => TIER_ENTITLEMENTS[t].referralEarnMultiplier)).toEqual([
      1.0, 1.25, 1.5, 2.0,
    ]);
  });

  it("monthly coupons: none / 1×5% / 2×10% / 4×15%; stacking only Plus+", () => {
    expect(TIER_ENTITLEMENTS.Free.monthlyCoupons).toBeNull();
    expect(TIER_ENTITLEMENTS.Basic.monthlyCoupons).toEqual({ count: 1, percentOff: 5 });
    expect(TIER_ENTITLEMENTS.Plus.monthlyCoupons).toEqual({ count: 2, percentOff: 10 });
    expect(TIER_ENTITLEMENTS.Premium.monthlyCoupons).toEqual({ count: 4, percentOff: 15 });
    expect(TIERS.map((t) => TIER_ENTITLEMENTS[t].couponStacking)).toEqual([
      false, false, true, true,
    ]);
  });

  it("JAX early access: 0h / 24h / 72h / 168h; members-only Premium only", () => {
    expect(TIERS.map((t) => TIER_ENTITLEMENTS[t].jaxEarlyAccessHours)).toEqual([
      0, 24, 72, 168,
    ]);
    expect(TIERS.map((t) => TIER_ENTITLEMENTS[t].jaxMembersOnly)).toEqual([
      false, false, false, true,
    ]);
  });

  it("event perks: 0/5/10/20% discount, 0/0/24/48h early, free quarterly ticket Premium only", () => {
    expect(TIERS.map((t) => TIER_ENTITLEMENTS[t].eventTicketDiscountPct)).toEqual([
      0, 5, 10, 20,
    ]);
    expect(TIERS.map((t) => TIER_ENTITLEMENTS[t].eventEarlyAccessHours)).toEqual([
      0, 0, 24, 48,
    ]);
    expect(TIERS.map((t) => TIER_ENTITLEMENTS[t].freeEventTicketsPerQuarter)).toEqual([
      0, 0, 0, 1,
    ]);
  });

  it("brand loyalty: none / Bronze 5% / Silver 10% / Gold 15%; threshold 3 orders", () => {
    expect(TIER_ENTITLEMENTS.Free.brandLoyalty).toBeNull();
    expect(TIER_ENTITLEMENTS.Basic.brandLoyalty).toEqual({ tier: "Bronze", percentOff: 5 });
    expect(TIER_ENTITLEMENTS.Plus.brandLoyalty).toEqual({ tier: "Silver", percentOff: 10 });
    expect(TIER_ENTITLEMENTS.Premium.brandLoyalty).toEqual({ tier: "Gold", percentOff: 15 });
    expect(BRAND_LOYALTY_ORDER_THRESHOLD).toBe(3);
  });

  it("higher tier ⊇ lower tier: every numeric perk is monotonically non-decreasing", () => {
    const numericKeys = [
      "pointsMultiplier",
      "subscriptionBonusPoints",
      "referralRewardPoints",
      "referralEarnMultiplier",
      "jaxEarlyAccessHours",
      "eventTicketDiscountPct",
      "eventEarlyAccessHours",
      "freeEventTicketsPerQuarter",
    ] as const;
    for (const key of numericKeys) {
      for (let i = 1; i < TIERS.length; i++) {
        const prev = TIER_ENTITLEMENTS[TIERS[i - 1]][key];
        const curr = TIER_ENTITLEMENTS[TIERS[i]][key];
        expect(curr, `${key}: ${TIERS[i]} >= ${TIERS[i - 1]}`).toBeGreaterThanOrEqual(prev);
      }
    }
  });

  it("hard order discount cap is 25% (CEO decision 2026-07-10)", () => {
    expect(ORDER_DISCOUNT_CAP_PCT).toBe(25);
  });
});

describe("legacy constants stay in sync with the entitlements SSOT", () => {
  it("consumer-loyalty maps mirror TIER_ENTITLEMENTS", () => {
    expect(LOYALTY_MULTIPLIERS.Starter).toBe(TIER_ENTITLEMENTS.Basic.pointsMultiplier);
    expect(LOYALTY_MULTIPLIERS.Plus).toBe(TIER_ENTITLEMENTS.Plus.pointsMultiplier);
    expect(LOYALTY_MULTIPLIERS.VIP).toBe(TIER_ENTITLEMENTS.Premium.pointsMultiplier);
    expect(REFERRAL_REWARD_POINTS.Free).toBe(TIER_ENTITLEMENTS.Free.referralRewardPoints);
    expect(REFERRAL_REWARD_POINTS.Starter).toBe(TIER_ENTITLEMENTS.Basic.referralRewardPoints);
    expect(REFERRAL_REWARD_POINTS.Plus).toBe(TIER_ENTITLEMENTS.Plus.referralRewardPoints);
    expect(REFERRAL_REWARD_POINTS.VIP).toBe(TIER_ENTITLEMENTS.Premium.referralRewardPoints);
  });
});
