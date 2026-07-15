import { describe, expect, it } from "vitest";
import { calculatePurchasePoints } from "@/lib/consumer-loyalty";
import { TIER_ENTITLEMENTS, planKeyToTier, type ConsumerTier } from "@/lib/entitlements";

/**
 * PR-2 contract (perks spec 2026-07-10, verification #1):
 * points awarded = dollars × 2 × pointsMultiplier (× high-spend 3× when ≥ $100).
 * The webhook resolves multiplier via TIER_ENTITLEMENTS[tier].pointsMultiplier;
 * Free (no active subscription) earns base points instead of nothing.
 */
describe("purchase points per tier", () => {
  const cases: Array<[ConsumerTier, number]> = [
    ["Free", 100], // $50 × 2 × 1.0
    ["Basic", 125], // $50 × 2 × 1.25
    ["Plus", 150], // $50 × 2 × 1.5
    ["Premium", 200], // $50 × 2 × 2.0
  ];

  it.each(cases)("$50 order as %s earns %i points", (tier, expected) => {
    const multiplier = TIER_ENTITLEMENTS[tier].pointsMultiplier;
    expect(calculatePurchasePoints(5000, multiplier)).toBe(expected);
  });

  it("high-spend 3× stacks with the tier multiplier (≥ $100)", () => {
    // $100 × 2 × 3 × 2.0 = 1200 for Premium
    expect(
      calculatePurchasePoints(10000, TIER_ENTITLEMENTS.Premium.pointsMultiplier)
    ).toBe(1200);
    // Free still gets the high-spend boost: $100 × 2 × 3 × 1.0 = 600
    expect(
      calculatePurchasePoints(10000, TIER_ENTITLEMENTS.Free.pointsMultiplier)
    ).toBe(600);
  });
});

describe("tiered subscription bonus source values", () => {
  it("start/renewal bonus reads 500/1000/2000 from the SSOT", () => {
    expect(
      TIER_ENTITLEMENTS[planKeyToTier("consumer_starter_monthly")]
        .subscriptionBonusPoints
    ).toBe(500);
    expect(
      TIER_ENTITLEMENTS[planKeyToTier("consumer_plus_annual")]
        .subscriptionBonusPoints
    ).toBe(1000);
    expect(
      TIER_ENTITLEMENTS[planKeyToTier("consumer_vip_monthly")]
        .subscriptionBonusPoints
    ).toBe(2000);
    // Unknown/missing plan key must award nothing (bonus 0 short-circuits).
    expect(TIER_ENTITLEMENTS[planKeyToTier(null)].subscriptionBonusPoints).toBe(0);
  });
});
