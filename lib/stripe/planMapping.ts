// lib/stripe/planMapping.ts
// Maps Stripe Price IDs (from STRIPE_PRICES) to internal plan keys for entitlements.
// Used by webhooks and any code that needs to resolve priceId -> internal plan key.

import { STRIPE_PRICES } from "./prices";

export type InternalPlanFromPriceId = {
  kind: "consumer" | "vendor";
  planKey: string;
  interval: "MONTHLY" | "ANNUAL";
};

const CONSUMER_STRIPE_TO_INTERNAL: Record<
  string,
  { planKey: string; interval: "MONTHLY" | "ANNUAL" }
> = {};

const VENDOR_STRIPE_TO_INTERNAL: Record<
  string,
  { planKey: string; interval: "MONTHLY" | "ANNUAL" }
> = {};

const addMapping = (
  map: Record<string, { planKey: string; interval: "MONTHLY" | "ANNUAL" }>,
  priceId: string,
  planKey: string,
  interval: "MONTHLY" | "ANNUAL"
) => {
  if (priceId) {
    map[priceId] = { planKey, interval };
  }
};

addMapping(
  CONSUMER_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.CONSUMER_BASIC.MONTHLY,
  "consumer_starter_monthly",
  "MONTHLY"
);
addMapping(
  CONSUMER_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.CONSUMER_BASIC.ANNUAL,
  "consumer_starter_annual",
  "ANNUAL"
);
addMapping(
  CONSUMER_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.CONSUMER_PLUS.MONTHLY,
  "consumer_plus_monthly",
  "MONTHLY"
);
addMapping(
  CONSUMER_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.CONSUMER_PLUS.ANNUAL,
  "consumer_plus_annual",
  "ANNUAL"
);
addMapping(
  CONSUMER_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.CONSUMER_PREMIUM.MONTHLY,
  "consumer_vip_monthly",
  "MONTHLY"
);
addMapping(
  CONSUMER_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.CONSUMER_PREMIUM.ANNUAL,
  "consumer_vip_annual",
  "ANNUAL"
);

addMapping(
  VENDOR_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.VENDOR_STARTER.MONTHLY,
  "vendor_starter_monthly",
  "MONTHLY"
);
addMapping(
  VENDOR_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.VENDOR_STARTER.ANNUAL,
  "vendor_starter_annual",
  "ANNUAL"
);
addMapping(
  VENDOR_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.VENDOR_GROWTH.MONTHLY,
  "vendor_pro_monthly",
  "MONTHLY"
);
addMapping(
  VENDOR_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.VENDOR_GROWTH.ANNUAL,
  "vendor_pro_annual",
  "ANNUAL"
);
addMapping(
  VENDOR_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.VENDOR_PRO.MONTHLY,
  "vendor_enterprise_monthly",
  "MONTHLY"
);
addMapping(
  VENDOR_STRIPE_TO_INTERNAL,
  STRIPE_PRICES.VENDOR_PRO.ANNUAL,
  "vendor_enterprise_annual",
  "ANNUAL"
);

/**
 * Resolve a Stripe Price ID to the internal plan key and interval.
 * Uses STRIPE_PRICES as the source of truth.
 * Returns null if priceId is not in the central price map (log and handle upstream).
 */
export function getInternalPlanFromStripePriceId(
  priceId: string | null | undefined
): InternalPlanFromPriceId | null {
  if (!priceId || typeof priceId !== "string") {
    return null;
  }
  const consumer = CONSUMER_STRIPE_TO_INTERNAL[priceId];
  if (consumer) {
    return { kind: "consumer", planKey: consumer.planKey, interval: consumer.interval };
  }
  const vendor = VENDOR_STRIPE_TO_INTERNAL[priceId];
  if (vendor) {
    return { kind: "vendor", planKey: vendor.planKey, interval: vendor.interval };
  }
  return null;
}
