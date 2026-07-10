import { describe, expect, it } from "vitest";
import {
  isReferralLinkEligible,
  isStarterConsumerPlanKey,
} from "@/lib/referral-eligibility";
import { TIER_ENTITLEMENTS } from "@/lib/entitlements";

describe("referral eligibility (perks spec 2026-07-10)", () => {
  it("identifies starter plan keys", () => {
    expect(isStarterConsumerPlanKey("consumer_starter_monthly")).toBe(true);
    expect(isStarterConsumerPlanKey("consumer_starter_annual")).toBe(true);
    expect(isStarterConsumerPlanKey("consumer_plus_monthly")).toBe(false);
    expect(isStarterConsumerPlanKey("consumer_vip_annual")).toBe(false);
  });

  it("allows referral links for every signed-in account — all tiers earn rewards", () => {
    // admins and vendors
    expect(
      isReferralLinkEligible({ isAdmin: true, consumerPlanKey: null, isVendorSubscribed: false })
    ).toBe(true);
    expect(
      isReferralLinkEligible({ isAdmin: false, consumerPlanKey: null, isVendorSubscribed: true })
    ).toBe(true);
    // paid consumers of every tier
    expect(
      isReferralLinkEligible({ isAdmin: false, consumerPlanKey: "consumer_plus_monthly", isVendorSubscribed: false })
    ).toBe(true);
    // free consumers (no plan) — matrix grants Free 100 pts per referral
    expect(
      isReferralLinkEligible({ isAdmin: false, consumerPlanKey: null, isVendorSubscribed: false })
    ).toBe(true);
  });
});

describe("referral reward math (verification #3)", () => {
  it("grant = referralRewardPoints × referralEarnMultiplier per tier", () => {
    const grant = (tier: keyof typeof TIER_ENTITLEMENTS) =>
      Math.round(
        TIER_ENTITLEMENTS[tier].referralRewardPoints *
          TIER_ENTITLEMENTS[tier].referralEarnMultiplier
      );
    expect(grant("Free")).toBe(100); // 100 × 1.0
    expect(grant("Basic")).toBe(313); // 250 × 1.25 = 312.5 → 313
    expect(grant("Plus")).toBe(750); // 500 × 1.5 — the spec's worked example
    expect(grant("Premium")).toBe(2000); // 1000 × 2.0
  });
});
