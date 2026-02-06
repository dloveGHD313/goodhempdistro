// lib/stripe/prices.ts
// Centralized Stripe Product & Price IDs for Good Hemp Distro
// This file is the single source of truth for Stripe pricing.
// Do NOT hardcode price IDs elsewhere in the application.

const getEnv = (name: string) => process.env[name]?.trim() || "";

/** Stripe Checkout uses PRICE IDs only. Product IDs (prod_*) are not used for checkout. */
export const STRIPE_PRICES = {
  CONSUMER_BASIC: {
    MONTHLY: "price_1SwBuhEKpXx4yA1Rfr2dSaOm",
    ANNUAL: "price_1SwCGFEKpXx4yA1R8xlFVsux",
  },

  CONSUMER_PLUS: {
    MONTHLY: "price_1SwBxSEKpXx4yA1RsYGbVU5Z",
    ANNUAL: "price_1SwCHIEKpXx4yA1RWCwWdCZO",
  },

  CONSUMER_PREMIUM: {
    MONTHLY: "price_1SwBySEKpXx4yA1R5FBo70my",
    ANNUAL: "price_1SwCIDEKpXx4yA1RXK7VMaao",
  },

  // Vendor: read ONLY from env (no fallbacks). See lib/pricing.ts for single source of truth.
  VENDOR_STARTER: {
    MONTHLY: getEnv("STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID"),
    ANNUAL: getEnv("STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID"),
  },

  VENDOR_PRO: {
    MONTHLY: getEnv("STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID"),
    ANNUAL: getEnv("STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID"),
  },

  VENDOR_ENTERPRISE: {
    MONTHLY: getEnv("STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID"),
    ANNUAL: getEnv("STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID"),
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PRICES;
export type BillingInterval = "MONTHLY" | "ANNUAL";
