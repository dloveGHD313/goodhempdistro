export type VendorPlanConfig = {
  key: string;
  tier: "Starter" | "Pro" | "Enterprise";
  cadence: "monthly" | "annual";
  interval: "month" | "year";
  priceId: string;
  displayName: string;
  priceDisplay: string;
  commission: number;
  productLimit: number | null;
  features: string[];
};

type VendorPlanEnv = {
  key: string;
  tier: VendorPlanConfig["tier"];
  cadence: VendorPlanConfig["cadence"];
  interval: VendorPlanConfig["interval"];
  envKey: string;
  priceDisplay: string;
  commission: number;
  productLimit: number | null;
  features: string[];
};

const VENDOR_PLAN_ENVS: VendorPlanEnv[] = [
  {
    key: "starter_monthly",
    tier: "Starter",
    cadence: "monthly",
    interval: "month",
    envKey: "STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID",
    priceDisplay: "$70/mo",
    commission: 7,
    productLimit: 10,
    features: ["Basic listing", "Monthly billing", "Limited products"],
  },
  {
    key: "starter_annual",
    tier: "Starter",
    cadence: "annual",
    interval: "year",
    envKey: "STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID",
    priceDisplay: "$714/yr",
    commission: 7,
    productLimit: 10,
    features: ["Basic listing", "Annual billing", "Limited products"],
  },
  {
    key: "pro_monthly",
    tier: "Pro",
    cadence: "monthly",
    interval: "month",
    envKey: "STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID",
    priceDisplay: "$150/mo",
    commission: 5,
    productLimit: 200,
    features: ["Priority placement", "Higher limits", "Monthly billing"],
  },
  {
    key: "pro_annual",
    tier: "Pro",
    cadence: "annual",
    interval: "year",
    envKey: "STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID",
    priceDisplay: "$1530/yr",
    commission: 5,
    productLimit: 200,
    features: ["Priority placement", "Higher limits", "Annual billing"],
  },
  {
    key: "enterprise_monthly",
    tier: "Enterprise",
    cadence: "monthly",
    interval: "month",
    envKey: "STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID",
    priceDisplay: "$275/mo",
    commission: 0,
    productLimit: null,
    features: ["Unlimited products", "Featured placement", "Monthly billing"],
  },
  {
    key: "enterprise_annual",
    tier: "Enterprise",
    cadence: "annual",
    interval: "year",
    envKey: "STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID",
    priceDisplay: "$2805/yr",
    commission: 0,
    productLimit: null,
    features: ["Unlimited products", "Featured placement", "Annual billing"],
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
      displayName: `${plan.tier} (${plan.cadence})`,
      priceDisplay: plan.priceDisplay,
      commission: plan.commission,
      productLimit: plan.productLimit,
      features: plan.features,
    });
  }

  return {
    plans,
    hasVendorPlans: plans.length > 0,
    missingEnv,
  };
}
