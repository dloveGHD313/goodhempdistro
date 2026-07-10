import { describe, expect, it } from "vitest";
import { brandStatusForTier } from "@/lib/brandLoyalty";
import { BRAND_LOYALTY_ORDER_THRESHOLD, TIER_ENTITLEMENTS } from "@/lib/entitlements";

describe("brandStatusForTier (perks spec §5)", () => {
  it("no status below the 3-order threshold, any tier", () => {
    for (const tier of ["Free", "Basic", "Plus", "Premium"] as const) {
      expect(brandStatusForTier(tier, 0)).toBe("None");
      expect(brandStatusForTier(tier, BRAND_LOYALTY_ORDER_THRESHOLD - 1)).toBe("None");
    }
  });

  it("at ≥3 orders: Basic→Bronze, Plus→Silver, Premium→Gold, Free→None (follow only)", () => {
    expect(brandStatusForTier("Free", 3)).toBe("None");
    expect(brandStatusForTier("Basic", 3)).toBe("Bronze");
    expect(brandStatusForTier("Plus", 3)).toBe("Silver");
    expect(brandStatusForTier("Premium", 3)).toBe("Gold");
    expect(brandStatusForTier("Premium", 10)).toBe("Gold");
  });

  it("brand coupon percentages come from the SSOT: 5/10/15", () => {
    expect(TIER_ENTITLEMENTS.Basic.brandLoyalty?.percentOff).toBe(5);
    expect(TIER_ENTITLEMENTS.Plus.brandLoyalty?.percentOff).toBe(10);
    expect(TIER_ENTITLEMENTS.Premium.brandLoyalty?.percentOff).toBe(15);
  });
});
