export type VendorPlanConfig = {
  key: string;
  tier: "Starter" | "Pro" | "Enterprise";
  cadence: "monthly" | "annual";
  interval: "month" | "year";
  priceId: string;
  displayName: string;
  headlinePriceText: string;
  subPriceNote?: string;
  commissionText: string;
  productLimitText: string;
  includedBullets: string[];
  limitationBullets: string[];
  imageUrl?: string | null;
  imageAlt?: string | null;
};

type VendorPlanEnv = {
  key: string;
  tier: VendorPlanConfig["tier"];
  cadence: VendorPlanConfig["cadence"];
  interval: VendorPlanConfig["interval"];
  envKey: string;
  displayName: string;
  headlinePriceText: string;
  subPriceNote?: string;
  commissionText: string;
  productLimitText: string;
  includedBullets: string[];
  limitationBullets: string[];
};

const VENDOR_PLAN_ENVS: VendorPlanEnv[] = [
  {
    key: "starter_monthly",
    tier: "Starter",
    cadence: "monthly",
    interval: "month",
    envKey: "STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID",
    displayName: "Vendor Starter",
    headlinePriceText: "$70/month",
    commissionText: "Commission: 7%",
    productLimitText: "Product Limit: Up to 10 products",
    includedBullets: [
      "Upload and sell up to 10 approved products",
      "Order fulfillment access",
      "Featured on public vendor feed",
      "Geographic listing for local discovery",
    ],
    limitationBullets: [
      "7% commission per sale",
      "No direct messaging with customers",
      "No external website links",
    ],
  },
  {
    key: "starter_annual",
    tier: "Starter",
    cadence: "annual",
    interval: "year",
    envKey: "STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID",
    displayName: "Vendor Starter",
    headlinePriceText: "$714/year",
    subPriceNote: "$840 | 15% off",
    commissionText: "Commission: 7%",
    productLimitText: "Product Limit: Up to 10 products",
    includedBullets: [
      "Upload and sell up to 10 approved products",
      "Order fulfillment access",
      "Featured on public vendor feed",
      "Geographic listing for local discovery",
    ],
    limitationBullets: [
      "7% commission per sale",
      "No direct messaging with customers",
      "No external website links",
    ],
  },
  {
    key: "pro_monthly",
    tier: "Pro",
    cadence: "monthly",
    interval: "month",
    envKey: "STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID",
    displayName: "Vendor Pro",
    headlinePriceText: "$150/month",
    commissionText: "Commission: 5%",
    productLimitText: "Product Limit: Up to 200 products",
    includedBullets: [
      "Upload and sell up to 200 approved products",
      "Reduced 5% commission",
      "Vendor logo & branded storefront",
      "Featured product announcements",
      "Ability to run discounts and promotions",
    ],
    limitationBullets: ["5% commission per sale", "No direct messaging with customers"],
  },
  {
    key: "pro_annual",
    tier: "Pro",
    cadence: "annual",
    interval: "year",
    envKey: "STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID",
    displayName: "Vendor Pro",
    headlinePriceText: "$1,530/year",
    subPriceNote: "$1,860 | 15% off",
    commissionText: "Commission: 5%",
    productLimitText: "Product Limit: Up to 200 products",
    includedBullets: [
      "Upload and sell up to 200 approved products",
      "Reduced 5% commission",
      "Vendor logo & branded storefront",
      "Mass email alerts for new products",
      "Ability to run discounts and promotions",
    ],
    limitationBullets: ["5% commission per sale", "No direct messaging with customers"],
  },
  {
    key: "enterprise_monthly",
    tier: "Enterprise",
    cadence: "monthly",
    interval: "month",
    envKey: "STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID",
    displayName: "Vendor Enterprise (VIP)",
    headlinePriceText: "$275/month",
    commissionText: "Commission: 0%",
    productLimitText: "Product Limit: Unlimited products",
    includedBullets: [
      "Upload unlimited approved products",
      "0% commission on all sales",
      "Direct messaging with customers",
      "External website link on vendor profile",
      "VIP placement and priority marketplace visibility",
      "Exclusive discounts & promo rewards",
    ],
    limitationBullets: [],
  },
  {
    key: "enterprise_annual",
    tier: "Enterprise",
    cadence: "annual",
    interval: "year",
    envKey: "STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID",
    displayName: "Vendor Enterprise (VIP)",
    headlinePriceText: "$2,805/year",
    subPriceNote: "$3,300 | 15% off",
    commissionText: "Commission: 0%",
    productLimitText: "Product Limit: Unlimited products",
    includedBullets: [
      "Upload unlimited approved products",
      "0% commission on all sales",
      "Direct messaging with customers",
      "External website link on vendor profile",
      "VIP placement and priority marketplace visibility",
      "Exclusive discounts & promo rewards",
      "Legacy Benefit: Annual subscribers may quality for legacy pricing",
    ],
    limitationBullets: [],
  },
];

export function getVendorPlanConfigs() {
  const plans: VendorPlanConfig[] = [];
  const missingEnv: string[] = [];

  for (const plan of VENDOR_PLAN_ENVS) {
    const priceId = process.env[plan.envKey];
    if (!priceId) {
      missingEnv.push(plan.envKey);
      continue;
    }
    plans.push({
      key: plan.key,
      tier: plan.tier,
      cadence: plan.cadence,
      interval: plan.interval,
      priceId,
      displayName: plan.displayName,
      headlinePriceText: plan.headlinePriceText,
      subPriceNote: plan.subPriceNote,
      commissionText: plan.commissionText,
      productLimitText: plan.productLimitText,
      includedBullets: plan.includedBullets,
      limitationBullets: plan.limitationBullets,
    });
  }

  return {
    plans,
    hasVendorPlans: plans.length > 0,
    missingEnv,
  };
}
