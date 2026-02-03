// lib/stripe/prices.ts
// Centralized Stripe Product & Price IDs for Good Hemp Distro
// This file is the single source of truth for Stripe pricing.
// Do NOT hardcode price IDs elsewhere in the application.

const isProd = process.env.NODE_ENV === "production";
const getEnv = (name: string) => process.env[name]?.trim() || "";
const getEnvOrDevFallback = (name: string, fallback: string) => {
  const value = getEnv(name);
  if (value) return value;
  return isProd ? "" : fallback;
};

const VENDOR_ENV_KEYS = [
  "STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID",
  "STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID",
  "STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID",
  "STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID",
  "STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID",
  "STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID",
] as const;

if (!isProd) {
  const missingVendorEnv = VENDOR_ENV_KEYS.filter((key) => !getEnv(key));
  if (missingVendorEnv.length > 0) {
    console.warn(
      "[stripe-prices] Missing vendor price env vars:",
      missingVendorEnv.join(", ")
    );
  }
}

export const STRIPE_PRODUCTS = {
  CONSUMER_BASIC: "prod_TtzumpIUrvB9AI",
  CONSUMER_PLUS: "prod_TtzxUhhELAktPM",
  CONSUMER_PREMIUM: "prod_TtzyXpCFxwfegg",

  VENDOR_STARTER: "prod_TtztSi1Bx6qJHO",
  VENDOR_GROWTH: "prod_TtzraQFuMqM22r",
  VENDOR_PRO: "prod_Ttzm5L3fBC7eF3",
} as const;

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

  VENDOR_STARTER: {
    MONTHLY: getEnvOrDevFallback(
      "STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID",
      "price_1SwBtKEKpXx4yA1ReX1LNk6s"
    ),
    ANNUAL: getEnvOrDevFallback(
      "STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID",
      "price_1SwCFBEKpXx4yA1RstiMk93D"
    ),
  },

  VENDOR_GROWTH: {
    MONTHLY: getEnvOrDevFallback(
      "STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID",
      "price_1SwBrqEKpXx4yA1RJVt7xOTX"
    ),
    ANNUAL: getEnvOrDevFallback(
      "STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID",
      "price_1SwCDYEKpXx4yA1RtmanSEdk"
    ),
  },

  VENDOR_PRO: {
    MONTHLY: getEnvOrDevFallback(
      "STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID",
      "price_1SwBmzEKpXx4yA1RgSYmvEPk"
    ),
    ANNUAL: getEnvOrDevFallback(
      "STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID",
      "price_1SwC8JEKpXx4yA1Rv6JPIy3U"
    ),
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PRICES;
export type BillingInterval = "MONTHLY" | "ANNUAL";
