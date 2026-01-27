export type VendorPlanConfig = {
  key: string;
  planKey: string;
  tier: "Starter" | "Pro" | "Enterprise";
  billingCycle: "monthly" | "annual";
  interval: "month" | "year";
  priceId: string;
  displayName: string;
  headlinePriceText: string;
  subPriceNote?: string;
  commissionText: string;
  commissionPercent: number;
  productLimitText: string;
  productLimit: number | null;
  includedBullets: string[];
  limitationBullets: string[];
  imageUrl: string;
  imageAlt: string;
};

type VendorPlanEnv = {
  key: string;
  planKey: string;
  tier: VendorPlanConfig["tier"];
  billingCycle: VendorPlanConfig["billingCycle"];
  interval: VendorPlanConfig["interval"];
  envKey: string;
  displayName: string;
  headlinePriceText: string;
  subPriceNote?: string;
  commissionText: string;
  commissionPercent: number;
  productLimitText: string;
  productLimit: number | null;
  includedBullets: string[];
  limitationBullets: string[];
  imageUrl: string;
  imageAlt: string;
};

const VENDOR_PLAN_ENVS: VendorPlanEnv[] = [
  {
    key: "starter_monthly",
    planKey: "vendor_starter_monthly",
    tier: "Starter",
    billingCycle: "monthly",
    interval: "month",
    envKey: "STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID",
    displayName: "Vendor Starter",
    headlinePriceText: "$70/month",
    commissionText: "Commission: 7%",
    commissionPercent: 7,
    productLimitText: "Product Limit: Up to 10 products",
    productLimit: 10,
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
    imageUrl: "/images/vendor-plans/vendor-starter-monthly.png",
    imageAlt: "Vendor Starter monthly plan",
  },
  {
    key: "starter_annual",
    planKey: "vendor_starter_annual",
    tier: "Starter",
    billingCycle: "annual",
    interval: "year",
    envKey: "STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID",
    displayName: "Vendor Starter",
    headlinePriceText: "$714/year",
    subPriceNote: "$840 | 15% off",
    commissionText: "Commission: 7%",
    commissionPercent: 7,
    productLimitText: "Product Limit: Up to 10 products",
    productLimit: 10,
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
    imageUrl: "/images/vendor-plans/vendor-starter-annual.png",
    imageAlt: "Vendor Starter annual plan",
  },
  {
    key: "pro_monthly",
    planKey: "vendor_pro_monthly",
    tier: "Pro",
    billingCycle: "monthly",
    interval: "month",
    envKey: "STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID",
    displayName: "Vendor Pro",
    headlinePriceText: "$150/month",
    commissionText: "Commission: 5%",
    commissionPercent: 5,
    productLimitText: "Product Limit: Up to 200 products",
    productLimit: 200,
    includedBullets: [
      "Upload and sell up to 200 approved products",
      "Reduced 5% commission",
      "Vendor logo & branded storefront",
      "Featured product announcements",
      "Ability to run discounts and promotions",
    ],
    limitationBullets: ["5% commission per sale", "No direct messaging with customers"],
    imageUrl: "/images/vendor-plans/vendor-pro-monthly.png",
    imageAlt: "Vendor Pro monthly plan",
  },
  {
    key: "pro_annual",
    planKey: "vendor_pro_annual",
    tier: "Pro",
    billingCycle: "annual",
    interval: "year",
    envKey: "STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID",
    displayName: "Vendor Pro",
    headlinePriceText: "$1,530/year",
    subPriceNote: "$1,860 | 15% off",
    commissionText: "Commission: 5%",
    commissionPercent: 5,
    productLimitText: "Product Limit: Up to 200 products",
    productLimit: 200,
    includedBullets: [
      "Upload and sell up to 200 approved products",
      "Reduced 5% commission",
      "Vendor logo & branded storefront",
      "Mass email alerts for new products",
      "Ability to run discounts and promotions",
    ],
    limitationBullets: ["5% commission per sale", "No direct messaging with customers"],
    imageUrl: "/images/vendor-plans/vendor-pro-annual.png",
    imageAlt: "Vendor Pro annual plan",
  },
  {
    key: "enterprise_monthly",
    planKey: "vendor_enterprise_monthly",
    tier: "Enterprise",
    billingCycle: "monthly",
    interval: "month",
    envKey: "STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID",
    displayName: "Vendor Enterprise (VIP)",
    headlinePriceText: "$275/month",
    commissionText: "Commission: 0%",
    commissionPercent: 0,
    productLimitText: "Product Limit: Unlimited products",
    productLimit: null,
    includedBullets: [
      "Upload unlimited approved products",
      "0% commission on all sales",
      "Direct messaging with customers",
      "External website link on vendor profile",
      "VIP placement and priority marketplace visibility",
      "Exclusive discounts & promo rewards",
    ],
    limitationBullets: [],
    imageUrl: "/images/vendor-plans/vendor-enterprise-monthly.png",
    imageAlt: "Vendor Enterprise monthly plan",
  },
  {
    key: "enterprise_annual",
    planKey: "vendor_enterprise_annual",
    tier: "Enterprise",
    billingCycle: "annual",
    interval: "year",
    envKey: "STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID",
    displayName: "Vendor Enterprise (VIP)",
    headlinePriceText: "$2,805/year",
    subPriceNote: "$3,300 | 15% off",
    commissionText: "Commission: 0%",
    commissionPercent: 0,
    productLimitText: "Product Limit: Unlimited products",
    productLimit: null,
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
    imageUrl: "/images/vendor-plans/vendor-enterprise-annual.png",
    imageAlt: "Vendor Enterprise annual plan",
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
      planKey: plan.planKey,
      tier: plan.tier,
      billingCycle: plan.billingCycle,
      interval: plan.interval,
      priceId,
      displayName: plan.displayName,
      headlinePriceText: plan.headlinePriceText,
      subPriceNote: plan.subPriceNote,
      commissionText: plan.commissionText,
      commissionPercent: plan.commissionPercent,
      productLimitText: plan.productLimitText,
      productLimit: plan.productLimit,
      includedBullets: plan.includedBullets,
      limitationBullets: plan.limitationBullets,
      imageUrl: plan.imageUrl,
      imageAlt: plan.imageAlt,
    });
  }

  return {
    plans,
    hasVendorPlans: plans.length > 0,
    missingEnv,
  };
}

export function getVendorPlanByPriceId(priceId: string) {
  const { plans } = getVendorPlanConfigs();
  return plans.find((plan) => plan.priceId === priceId) || null;
}

export function getVendorEntitlements(planKey: string) {
  const { plans } = getVendorPlanConfigs();
  const match = plans.find((plan) => plan.planKey === planKey);
  if (!match) {
    return null;
  }
  return {
    productLimit: match.productLimit,
    commissionPercent: match.commissionPercent,
    tier: match.tier,
  };
}

export function getProductLimitStatus(count: number, limit: number | null) {
  if (limit === null) {
    return { reached: false, limit: null };
  }
  return { reached: count >= limit, limit };
}
