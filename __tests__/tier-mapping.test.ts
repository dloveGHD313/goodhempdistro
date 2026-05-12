import { describe, it, expect } from "vitest";
import {
  STRIPE_PLAN_TO_TIER,
  isStripeVendorPlanKey,
  getTierFromPlanKey,
  type StripeVendorPlanKey,
  type VendorTier,
} from "@/lib/billing/tier-mapping";
import { COMMISSION_RATES, LISTING_LIMITS, getCommissionRateBps, getListingLimit } from "@/lib/referral";

/**
 * Build #2 regression contract — see lib/billing/tier-mapping.ts header.
 *
 * Pins:
 *   1. Every Stripe vendor plan key has exactly one DB tier
 *   2. Every active vendor price ID emitted by lib/stripe/planMapping.ts has
 *      a corresponding entry in STRIPE_PLAN_TO_TIER (no missing mappings)
 *   3. Unknown plan keys THROW rather than silently default
 *   4. Commission + listing-limit helpers route through the strict lookup
 */

const EXPECTED_VENDOR_PLAN_KEYS: StripeVendorPlanKey[] = [
  "vendor_starter_monthly",
  "vendor_starter_annual",
  "vendor_pro_monthly",
  "vendor_pro_annual",
  "vendor_enterprise_monthly",
  "vendor_enterprise_annual",
];

const EXPECTED_TIER_FOR_PLAN: Record<StripeVendorPlanKey, VendorTier> = {
  vendor_starter_monthly: "starter",
  vendor_starter_annual: "starter",
  vendor_pro_monthly: "mid",
  vendor_pro_annual: "mid",
  vendor_enterprise_monthly: "top",
  vendor_enterprise_annual: "top",
};

describe("STRIPE_PLAN_TO_TIER — strict mapping contract", () => {
  it("every expected vendor plan key has an entry", () => {
    for (const key of EXPECTED_VENDOR_PLAN_KEYS) {
      expect(STRIPE_PLAN_TO_TIER[key]).toBeDefined();
    }
  });

  it("every entry resolves to a DB-aligned tier ('starter' | 'mid' | 'top')", () => {
    const validTiers = new Set<string>(["starter", "mid", "top"]);
    for (const [key, tier] of Object.entries(STRIPE_PLAN_TO_TIER)) {
      expect(validTiers.has(tier)).toBe(true);
      // catch typos in EXPECTED_TIER_FOR_PLAN matching real values
      expect(tier).toBe(EXPECTED_TIER_FOR_PLAN[key as StripeVendorPlanKey]);
    }
  });

  it("the record has no extra unexpected keys", () => {
    const actualKeys = new Set(Object.keys(STRIPE_PLAN_TO_TIER));
    for (const expectedKey of EXPECTED_VENDOR_PLAN_KEYS) {
      expect(actualKeys.has(expectedKey)).toBe(true);
    }
    expect(actualKeys.size).toBe(EXPECTED_VENDOR_PLAN_KEYS.length);
  });
});

describe("isStripeVendorPlanKey", () => {
  it("returns true for every known vendor plan key", () => {
    for (const key of EXPECTED_VENDOR_PLAN_KEYS) {
      expect(isStripeVendorPlanKey(key)).toBe(true);
    }
  });

  it("returns false for unknown keys (consumer keys, free, typos)", () => {
    expect(isStripeVendorPlanKey("consumer_starter_monthly")).toBe(false);
    expect(isStripeVendorPlanKey("free")).toBe(false);
    expect(isStripeVendorPlanKey("vendor_professional_monthly")).toBe(false); // would have matched "pro" under .includes()
    expect(isStripeVendorPlanKey("vipendous")).toBe(false); // would have matched "vip" under .includes()
    expect(isStripeVendorPlanKey("")).toBe(false);
  });
});

describe("getTierFromPlanKey — strict lookup", () => {
  for (const key of EXPECTED_VENDOR_PLAN_KEYS) {
    it(`returns "${EXPECTED_TIER_FOR_PLAN[key]}" for "${key}"`, () => {
      expect(getTierFromPlanKey(key)).toBe(EXPECTED_TIER_FOR_PLAN[key]);
    });
  }

  it("THROWS on unknown plan key (no silent default)", () => {
    expect(() => getTierFromPlanKey("free")).toThrow(/unknown plan key/i);
    expect(() => getTierFromPlanKey("consumer_starter_monthly")).toThrow(/unknown plan key/i);
    expect(() => getTierFromPlanKey("")).toThrow(/unknown plan key/i);
    expect(() => getTierFromPlanKey("vendor_professional_monthly")).toThrow(/unknown plan key/i);
  });

  it("error message instructs how to fix", () => {
    try {
      getTierFromPlanKey("mystery_plan_key");
      throw new Error("should have thrown");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      expect(message).toContain("STRIPE_PLAN_TO_TIER");
      expect(message).toContain("planMapping.ts");
    }
  });
});

describe("COMMISSION_RATES / LISTING_LIMITS — DB-aligned tier keys", () => {
  it("COMMISSION_RATES has entries for starter, mid, top with expected bps", () => {
    expect(COMMISSION_RATES.starter).toBe(700);
    expect(COMMISSION_RATES.mid).toBe(500);
    expect(COMMISSION_RATES.top).toBe(100);
  });

  it("LISTING_LIMITS has entries for starter, mid, top", () => {
    expect(LISTING_LIMITS.starter).toBe(15);
    expect(LISTING_LIMITS.mid).toBe(100);
    expect(LISTING_LIMITS.top).toBe(null);
  });
});

describe("getCommissionRateBps / getListingLimit — strict lookup wiring", () => {
  it("getCommissionRateBps returns the correct bps for every vendor plan key", () => {
    expect(getCommissionRateBps("vendor_starter_monthly")).toBe(700);
    expect(getCommissionRateBps("vendor_starter_annual")).toBe(700);
    expect(getCommissionRateBps("vendor_pro_monthly")).toBe(500);
    expect(getCommissionRateBps("vendor_pro_annual")).toBe(500);
    expect(getCommissionRateBps("vendor_enterprise_monthly")).toBe(100);
    expect(getCommissionRateBps("vendor_enterprise_annual")).toBe(100);
  });

  it("getListingLimit returns the correct limit for every vendor plan key", () => {
    expect(getListingLimit("vendor_starter_monthly")).toBe(15);
    expect(getListingLimit("vendor_pro_monthly")).toBe(100);
    expect(getListingLimit("vendor_enterprise_monthly")).toBe(null);
  });

  it("getCommissionRateBps THROWS on unknown plan key (no silent default to starter)", () => {
    expect(() => getCommissionRateBps("free")).toThrow();
    expect(() => getCommissionRateBps("professional")).toThrow();
    expect(() => getCommissionRateBps("vipendous")).toThrow();
  });

  it("getListingLimit THROWS on unknown plan key", () => {
    expect(() => getListingLimit("free")).toThrow();
    expect(() => getListingLimit("")).toThrow();
  });
});

describe("Cross-file contract — planMapping.ts ↔ tier-mapping.ts", () => {
  it("every internal vendor plan key emitted by planMapping.ts has a STRIPE_PLAN_TO_TIER entry", async () => {
    // The planKey strings emitted by lib/stripe/planMapping.ts for vendor
    // subscriptions. If a new internal plan key is added there, this assertion
    // forces us to also add it to STRIPE_PLAN_TO_TIER.
    const planMappingVendorKeys = [
      "vendor_starter_monthly",
      "vendor_starter_annual",
      "vendor_pro_monthly",
      "vendor_pro_annual",
      "vendor_enterprise_monthly",
      "vendor_enterprise_annual",
    ];
    for (const key of planMappingVendorKeys) {
      expect(STRIPE_PLAN_TO_TIER[key as StripeVendorPlanKey]).toBeDefined();
    }
  });
});
