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
> = {
  [STRIPE_PRICES.CONSUMER_BASIC.MONTHLY]: {
    planKey: "consumer_starter_monthly",
    interval: "MONTHLY",
  },
  [STRIPE_PRICES.CONSUMER_BASIC.ANNUAL]: {
    planKey: "consumer_starter_annual",
    interval: "ANNUAL",
  },
  [STRIPE_PRICES.CONSUMER_PLUS.MONTHLY]: {
    planKey: "consumer_plus_monthly",
    interval: "MONTHLY",
  },
  [STRIPE_PRICES.CONSUMER_PLUS.ANNUAL]: {
    planKey: "consumer_plus_annual",
    interval: "ANNUAL",
  },
  [STRIPE_PRICES.CONSUMER_PREMIUM.MONTHLY]: {
    planKey: "consumer_vip_monthly",
    interval: "MONTHLY",
  },
  [STRIPE_PRICES.CONSUMER_PREMIUM.ANNUAL]: {
    planKey: "consumer_vip_annual",
    interval: "ANNUAL",
  },
};

const VENDOR_STRIPE_TO_INTERNAL: Record<
  string,
  { planKey: string; interval: "MONTHLY" | "ANNUAL" }
> = {
  [STRIPE_PRICES.VENDOR_STARTER.MONTHLY]: {
    planKey: "vendor_starter_monthly",
    interval: "MONTHLY",
  },
  [STRIPE_PRICES.VENDOR_STARTER.ANNUAL]: {
    planKey: "vendor_starter_annual",
    interval: "ANNUAL",
  },
  [STRIPE_PRICES.VENDOR_GROWTH.MONTHLY]: {
    planKey: "vendor_pro_monthly",
    interval: "MONTHLY",
  },
  [STRIPE_PRICES.VENDOR_GROWTH.ANNUAL]: {
    planKey: "vendor_pro_annual",
    interval: "ANNUAL",
  },
  [STRIPE_PRICES.VENDOR_PRO.MONTHLY]: {
    planKey: "vendor_enterprise_monthly",
    interval: "MONTHLY",
  },
  [STRIPE_PRICES.VENDOR_PRO.ANNUAL]: {
    planKey: "vendor_enterprise_annual",
    interval: "ANNUAL",
  },
};

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
