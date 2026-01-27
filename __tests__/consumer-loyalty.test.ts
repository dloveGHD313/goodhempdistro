import { describe, expect, it } from "vitest";
import {
  BASE_POINTS_PER_DOLLAR,
  LOYALTY_MULTIPLIERS,
  REFERRAL_REWARD_POINTS,
  SUBSCRIPTION_BONUS_POINTS,
  calculatePurchasePoints,
} from "@/lib/consumer-loyalty";
import { ensureReferralCode } from "@/lib/consumer-referrals";

describe("consumer loyalty rules", () => {
  it("returns correct loyalty multipliers", () => {
    expect(LOYALTY_MULTIPLIERS.Starter).toBe(1.0);
    expect(LOYALTY_MULTIPLIERS.Plus).toBe(1.5);
    expect(LOYALTY_MULTIPLIERS.VIP).toBe(2.0);
  });

  it("returns correct referral reward points", () => {
    expect(REFERRAL_REWARD_POINTS.Starter).toBe(250);
    expect(REFERRAL_REWARD_POINTS.Plus).toBe(500);
    expect(REFERRAL_REWARD_POINTS.VIP).toBe(1000);
  });

  it("uses explicit subscription bonus points", () => {
    expect(SUBSCRIPTION_BONUS_POINTS).toBeGreaterThan(0);
  });

  it("uses explicit base points per dollar", () => {
    expect(BASE_POINTS_PER_DOLLAR).toBeGreaterThan(0);
  });

  it("calculates purchase points using multiplier", () => {
    expect(calculatePurchasePoints(1999, 1.5)).toBeGreaterThan(0);
    expect(calculatePurchasePoints(0, 2)).toBe(0);
  });
});

describe("consumer referrals helper", () => {
  it("keeps existing referral code to prevent duplicates", () => {
    const code = ensureReferralCode("GHD-ABC123", () => "GHD-NEW456");
    expect(code).toBe("GHD-ABC123");
  });

  it("generates referral code when missing", () => {
    const code = ensureReferralCode(null, () => "GHD-NEW456");
    expect(code).toBe("GHD-NEW456");
  });
});
