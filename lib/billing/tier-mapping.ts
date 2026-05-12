// lib/billing/tier-mapping.ts
//
// Strict Stripe internal-plan-key → DB vendor tier lookup.
//
// Replaces the `.includes()` substring matching that previously lived in
// lib/referral.ts (getCommissionRateBps, getListingLimit). Substring matching
// was footgun-prone: "professional" would have matched "pro", "vipendous"
// would have matched "vip", etc. This strict table throws on unknown plan
// keys so future Stripe price additions either get explicit tier assignments
// or fail loudly at runtime.
//
// PRICE ID → PLAN KEY → TIER chain:
//
//   Stripe Price ID                      Internal Plan Key              DB Tier
//   ---------------------------------    --------------------------     -------
//   STRIPE_VENDOR_STARTER_MONTHLY        vendor_starter_monthly         starter
//   STRIPE_VENDOR_STARTER_ANNUAL         vendor_starter_annual          starter
//   STRIPE_VENDOR_PRO_MONTHLY            vendor_pro_monthly             mid
//   STRIPE_VENDOR_PRO_ANNUAL             vendor_pro_annual              mid
//   STRIPE_VENDOR_ENTERPRISE_MONTHLY     vendor_enterprise_monthly      top
//   STRIPE_VENDOR_ENTERPRISE_ANNUAL      vendor_enterprise_annual       top
//
// The UI surfaces "Starter / Pro / Enterprise" as marketing names; the DB
// column `vendors.tier` uses `starter | mid | top`. This file is the
// translation layer.
//
// To add a new vendor tier or interval:
//   1. Add the Stripe price entry to lib/stripe/prices.ts
//   2. Add a mapping line to lib/stripe/planMapping.ts that emits the new
//      internal plan key
//   3. Add the new plan key to StripeVendorPlanKey union AND
//      STRIPE_PLAN_TO_TIER record below
//   4. Run the test suite — tier-mapping.test.ts will catch any drift

/** DB-aligned vendor tier names (must match the production vendors.tier values). */
export type VendorTier = "starter" | "mid" | "top";

/** Stripe internal plan keys for vendor subscriptions emitted by lib/stripe/planMapping.ts. */
export type StripeVendorPlanKey =
  | "vendor_starter_monthly"
  | "vendor_starter_annual"
  | "vendor_pro_monthly"
  | "vendor_pro_annual"
  | "vendor_enterprise_monthly"
  | "vendor_enterprise_annual";

/**
 * Strict mapping: Stripe internal plan key → DB tier value.
 * The test suite enforces every vendor plan key in lib/stripe/planMapping.ts
 * has an entry here.
 */
export const STRIPE_PLAN_TO_TIER: Record<StripeVendorPlanKey, VendorTier> = {
  vendor_starter_monthly: "starter",
  vendor_starter_annual: "starter",
  vendor_pro_monthly: "mid",
  vendor_pro_annual: "mid",
  vendor_enterprise_monthly: "top",
  vendor_enterprise_annual: "top",
};

/** Type guard: is this string one of the known StripeVendorPlanKey values? */
export function isStripeVendorPlanKey(key: string): key is StripeVendorPlanKey {
  return Object.prototype.hasOwnProperty.call(STRIPE_PLAN_TO_TIER, key);
}

/**
 * Resolve a plan key to a vendor tier. **Throws on unknown key — no silent default.**
 *
 * Use this in commission calculation, listing-limit lookup, and anywhere
 * tier-based entitlements branch. Callers that legitimately handle non-vendor
 * plan keys (e.g. consumer plans, "free" users) should check `isStripeVendorPlanKey`
 * first instead of catching this throw.
 */
export function getTierFromPlanKey(planKey: string): VendorTier {
  const tier = STRIPE_PLAN_TO_TIER[planKey as StripeVendorPlanKey];
  if (!tier) {
    throw new Error(
      `[tier-mapping] Unknown plan key "${planKey}". ` +
      `Add it to STRIPE_PLAN_TO_TIER in lib/billing/tier-mapping.ts and ` +
      `verify lib/stripe/planMapping.ts emits it.`
    );
  }
  return tier;
}
