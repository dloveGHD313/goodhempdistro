import { describe, it, expect } from "vitest";
import { COMMISSION_RATES } from "@/lib/referral";
import { VENDOR_PLAN_ENVS } from "@/lib/pricing";
import { STRIPE_PLAN_TO_TIER } from "@/lib/billing/tier-mapping";
import type { VendorTier } from "@/lib/billing/tier-mapping";

/**
 * P1-1 regression contract — ONE commission schedule: 7/5/1.
 *
 * CEO decision 2026-07-03: the 1% charged at checkout is correct (matches
 * the April CEO-confirmed DB state); the pricing page's advertised
 * Enterprise 0% was the error. All three layers must agree:
 *
 *   Layer 1 — advertised copy    lib/pricing.ts VENDOR_PLAN_ENVS
 *             (tested against the raw static config, NOT
 *              getVendorPlanConfigs(), which filters plans by env price
 *              IDs and would silently skip tiers in test environments)
 *   Layer 2 — charged at checkout lib/referral.ts COMMISSION_RATES (bps)
 *   Layer 3 — post-payment ledger platform_fee_rules item_type='product'
 *             (DB rows updated to 700/500/100 in migration
 *              20260703_platform_fee_rules_product_unify_751; not directly
 *              testable here — pinned by the SQL + this comment)
 *
 * If layers 1 or 2 drift again, this file is the tripwire.
 */

const CANONICAL_BPS: Record<VendorTier, number> = {
  starter: 700, // 7%
  mid: 500, // 5%
  top: 100, // 1%
};

const MARKETING_TIER_TO_DB: Record<string, VendorTier> = {
  Starter: "starter",
  Pro: "mid",
  Enterprise: "top",
};

describe("Layer 2 — checkout COMMISSION_RATES is the canonical 7/5/1", () => {
  it("starter = 700 bps", () => expect(COMMISSION_RATES.starter).toBe(CANONICAL_BPS.starter));
  it("mid = 500 bps", () => expect(COMMISSION_RATES.mid).toBe(CANONICAL_BPS.mid));
  it("top = 100 bps (1%, NOT 0%)", () => expect(COMMISSION_RATES.top).toBe(CANONICAL_BPS.top));
});

describe("Layer 1 — advertised commissionPercent matches charged bps for every vendor plan", () => {
  it("static config covers all three marketing tiers (both cadences)", () => {
    const tiers = new Set(VENDOR_PLAN_ENVS.map((p) => p.tier));
    expect(tiers.has("Starter")).toBe(true);
    expect(tiers.has("Pro")).toBe(true);
    expect(tiers.has("Enterprise")).toBe(true);
    expect(VENDOR_PLAN_ENVS.length).toBe(6); // 3 tiers × monthly/annual
  });

  for (const plan of VENDOR_PLAN_ENVS) {
    it(`${plan.planKey}: advertised ${plan.commissionPercent}% == charged bps / 100`, () => {
      const dbTier = MARKETING_TIER_TO_DB[plan.tier];
      expect(dbTier).toBeDefined();
      expect(plan.commissionPercent * 100).toBe(CANONICAL_BPS[dbTier]);
      // Display string agrees with the numeric field
      expect(plan.commissionText).toContain(`${plan.commissionPercent}%`);
    });
  }

  it("no plan advertises 0% commission anywhere in its copy", () => {
    for (const plan of VENDOR_PLAN_ENVS) {
      expect(plan.commissionText).not.toMatch(/\b0%/);
      for (const bullet of plan.includedBullets) {
        expect(bullet).not.toMatch(/\b0% commission/i);
      }
    }
  });
});

describe("Tier mapping consistency — plan keys resolve to tiers with canonical rates", () => {
  it("every STRIPE_PLAN_TO_TIER target has a canonical rate", () => {
    for (const tier of Object.values(STRIPE_PLAN_TO_TIER)) {
      expect(CANONICAL_BPS[tier]).toBeDefined();
      expect(COMMISSION_RATES[tier]).toBe(CANONICAL_BPS[tier]);
    }
  });
});
