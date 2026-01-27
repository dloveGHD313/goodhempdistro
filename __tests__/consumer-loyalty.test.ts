import { describe, expect, it } from "vitest";
import {
  BASE_POINTS_PER_DOLLAR,
  BONUS_POINTS_PER_100_SPENT,
  HIGH_SPEND_MULTIPLIER,
  HIGH_SPEND_THRESHOLD_DOLLARS,
  LOYALTY_MULTIPLIERS,
  POINT_VALUE_CENTS,
  REFERRAL_REWARD_POINTS,
  REFERRAL_SIGNUP_BONUS_POINTS,
  SUBSCRIPTION_BONUS_POINTS,
  calculatePurchasePoints,
  getSpendMilestonesToAward,
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
    expect(BASE_POINTS_PER_DOLLAR).toBe(2);
  });

  it("defines explicit point value and bonus constants", () => {
    expect(POINT_VALUE_CENTS).toBe(1);
    expect(HIGH_SPEND_THRESHOLD_DOLLARS).toBe(100);
    expect(HIGH_SPEND_MULTIPLIER).toBe(3);
    expect(BONUS_POINTS_PER_100_SPENT).toBe(100);
    expect(REFERRAL_SIGNUP_BONUS_POINTS).toBe(1);
  });

  it("calculates purchase points with base rate", () => {
    expect(calculatePurchasePoints(2599, 1)).toBe(50);
    expect(calculatePurchasePoints(0, 2)).toBe(0);
  });

  it("triples points for purchases over threshold", () => {
    expect(calculatePurchasePoints(10000, 1)).toBe(600);
  });

  it("returns milestones to award based on total spend", () => {
    expect(getSpendMilestonesToAward(9999, [])).toEqual([]);
    expect(getSpendMilestonesToAward(10000, [])).toEqual([1]);
    expect(getSpendMilestonesToAward(25000, [1])).toEqual([2]);
    expect(getSpendMilestonesToAward(35000, [1, 2])).toEqual([3]);
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
