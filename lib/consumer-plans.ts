export type ConsumerPlanConfig = {
  planKey: string;
  tier: "Starter" | "Plus" | "VIP";
  cadence: "monthly" | "annual";
  billingInterval: "month" | "year";
  priceId: string;
  displayName: string;
  priceText: string;
  loyaltyMultiplier: number;
  referralRewardPoints: number;
  imageUrl: string;
  imageAlt: string;
  bullets: string[];
};

type ConsumerPlanEnv = {
  planKey: ConsumerPlanConfig["planKey"];
  tier: ConsumerPlanConfig["tier"];
  cadence: ConsumerPlanConfig["cadence"];
  billingInterval: ConsumerPlanConfig["billingInterval"];
  envKey: string;
  displayName: string;
  priceText: string;
  loyaltyMultiplier: number;
  referralRewardPoints: number;
  imageUrl: string;
  imageAlt: string;
  bullets: string[];
};

type ConsumerPlanEnvStatus = {
  missingEnv: string[];
  hiddenPlans: Array<{
    planKey: ConsumerPlanConfig["planKey"];
    envKey: string;
    reason: "missing_env";
  }>;
  totalPlans: number;
  availablePlans: number;
};

const CONSUMER_PLAN_ENVS: ConsumerPlanEnv[] = [
  {
    planKey: "consumer_starter_monthly",
    tier: "Starter",
    cadence: "monthly",
    billingInterval: "month",
    envKey: "STRIPE_CONSUMER_STARTER_MONTHLY_PRICE_ID",
    displayName: "Consumer Starter",
    priceText: "$5.99/month (Monthly Plan)",
    loyaltyMultiplier: 1.0,
    referralRewardPoints: 250,
    imageUrl: "/images/consumer-plans/consumer-starter-monthly.png",
    imageAlt: "Consumer Starter monthly plan",
    bullets: ["Earn loyalty points", "See verified vendors", "Save favorites"],
  },
  {
    planKey: "consumer_starter_annual",
    tier: "Starter",
    cadence: "annual",
    billingInterval: "year",
    envKey: "STRIPE_CONSUMER_STARTER_ANNUAL_PRICE_ID",
    displayName: "Consumer Starter",
    priceText: "$64.69/year (Annual Plan - 10% Off)",
    loyaltyMultiplier: 1.0,
    referralRewardPoints: 250,
    imageUrl: "/images/consumer-plans/consumer-starter-annual.png",
    imageAlt: "Consumer Starter annual plan",
    bullets: ["Earn loyalty points", "See verified vendors", "Save favorites"],
  },
  {
    planKey: "consumer_plus_monthly",
    tier: "Plus",
    cadence: "monthly",
    billingInterval: "month",
    envKey: "STRIPE_CONSUMER_PLUS_MONTHLY_PRICE_ID",
    displayName: "Consumer Plus",
    priceText: "$7.99/month (Monthly Plan)",
    loyaltyMultiplier: 1.5,
    referralRewardPoints: 500,
    imageUrl: "/images/consumer-plans/consumer-plus-monthly.png",
    imageAlt: "Consumer Plus monthly plan",
    bullets: [
      "Boosted loyalty points",
      "Early access to drops",
      "Member-only offers",
      "Priority shipping",
    ],
  },
  {
    planKey: "consumer_plus_annual",
    tier: "Plus",
    cadence: "annual",
    billingInterval: "year",
    envKey: "STRIPE_CONSUMER_PLUS_ANNUAL_PRICE_ID",
    displayName: "Consumer Plus",
    priceText: "$86.29/year (Annual Plan - 10% Off)",
    loyaltyMultiplier: 1.5,
    referralRewardPoints: 500,
    imageUrl: "/images/consumer-plans/consumer-plus-annual.png",
    imageAlt: "Consumer Plus annual plan",
    bullets: [
      "1.5x loyalty points",
      "Early access to drops",
      "Member-only offers",
      "Priority ticketing",
    ],
  },
  {
    planKey: "consumer_vip_monthly",
    tier: "VIP",
    cadence: "monthly",
    billingInterval: "month",
    envKey: "STRIPE_CONSUMER_VIP_MONTHLY_PRICE_ID",
    displayName: "Consumer VIP",
    priceText: "$12.99/month (Monthly Plan)",
    loyaltyMultiplier: 2.0,
    referralRewardPoints: 1000,
    imageUrl: "/images/consumer-plans/consumer-vip-monthly.png",
    imageAlt: "Consumer VIP monthly plan",
    bullets: [
      "2x loyalty points",
      "Exclusive VIP deals",
      "Free delivery & events",
      "Priority ticketing",
    ],
  },
  {
    planKey: "consumer_vip_annual",
    tier: "VIP",
    cadence: "annual",
    billingInterval: "year",
    envKey: "STRIPE_CONSUMER_VIP_ANNUAL_PRICE_ID",
    displayName: "Consumer VIP",
    priceText: "$140.29/year (Annual Plan - 10% Off)",
    loyaltyMultiplier: 2.0,
    referralRewardPoints: 1000,
    imageUrl: "/images/consumer-plans/consumer-vip-annual.png",
    imageAlt: "Consumer VIP annual plan",
    bullets: [
      "2x loyalty points",
      "Exclusive VIP deals",
      "Free delivery & events",
      "Priority ticketing",
    ],
  },
];

export function getConsumerPlanConfigs() {
  const plans: ConsumerPlanConfig[] = [];
  const missingEnv: string[] = [];

  for (const plan of CONSUMER_PLAN_ENVS) {
    const priceId = process.env[plan.envKey];
    if (!priceId) {
      missingEnv.push(plan.envKey);
      continue;
    }
    plans.push({
      planKey: plan.planKey,
      tier: plan.tier,
      cadence: plan.cadence,
      billingInterval: plan.billingInterval,
      priceId,
      displayName: plan.displayName,
      priceText: plan.priceText,
      loyaltyMultiplier: plan.loyaltyMultiplier,
      referralRewardPoints: plan.referralRewardPoints,
      imageUrl: plan.imageUrl,
      imageAlt: plan.imageAlt,
      bullets: plan.bullets,
    });
  }

  return {
    plans,
    hasConsumerPlans: plans.length > 0,
    missingEnv,
  };
}

export function getConsumerPlanEnvStatus(): ConsumerPlanEnvStatus {
  const hiddenPlans: ConsumerPlanEnvStatus["hiddenPlans"] = [];
  const missingEnv: string[] = [];
  let availablePlans = 0;

  for (const plan of CONSUMER_PLAN_ENVS) {
    const priceId = process.env[plan.envKey];
    if (!priceId) {
      missingEnv.push(plan.envKey);
      hiddenPlans.push({
        planKey: plan.planKey,
        envKey: plan.envKey,
        reason: "missing_env",
      });
    } else {
      availablePlans += 1;
    }
  }

  return {
    missingEnv,
    hiddenPlans,
    totalPlans: CONSUMER_PLAN_ENVS.length,
    availablePlans,
  };
}

export function getConsumerPlanByPriceId(priceId: string) {
  const { plans } = getConsumerPlanConfigs();
  return plans.find((plan) => plan.priceId === priceId) || null;
}

export function getConsumerPlanByKey(planKey: string) {
  const { plans } = getConsumerPlanConfigs();
  return plans.find((plan) => plan.planKey === planKey) || null;
}

export function getConsumerEntitlements(planKey: string) {
  const { plans } = getConsumerPlanConfigs();
  const match = plans.find((plan) => plan.planKey === planKey);
  if (!match) {
    return null;
  }
  return {
    tier: match.tier,
    billingInterval: match.billingInterval,
    loyaltyMultiplier: match.loyaltyMultiplier,
    referralRewardPoints: match.referralRewardPoints,
  };
}
