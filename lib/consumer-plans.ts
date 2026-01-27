export type ConsumerPlanConfig = {
  planKey: string;
  tier: "Starter" | "Plus" | "VIP";
  billingCycle: "monthly" | "annual";
  priceId: string;
  displayName: string;
  featureSummary: string[];
};

type ConsumerPlanEnv = {
  planKey: ConsumerPlanConfig["planKey"];
  tier: ConsumerPlanConfig["tier"];
  billingCycle: ConsumerPlanConfig["billingCycle"];
  envKey: string;
  displayName: string;
  featureSummary: string[];
};

const CONSUMER_PLAN_ENVS: ConsumerPlanEnv[] = [
  {
    planKey: "consumer_starter_monthly",
    tier: "Starter",
    billingCycle: "monthly",
    envKey: "STRIPE_CONSUMER_STARTER_MONTHLY_PRICE_ID",
    displayName: "Consumer Starter",
    featureSummary: [
      "Monthly loyalty points",
      "Subscriber-only offers",
      "Member rewards",
    ],
  },
  {
    planKey: "consumer_starter_annual",
    tier: "Starter",
    billingCycle: "annual",
    envKey: "STRIPE_CONSUMER_STARTER_ANNUAL_PRICE_ID",
    displayName: "Consumer Starter",
    featureSummary: [
      "Monthly loyalty points",
      "Subscriber-only offers",
      "Member rewards",
    ],
  },
  {
    planKey: "consumer_plus_monthly",
    tier: "Plus",
    billingCycle: "monthly",
    envKey: "STRIPE_CONSUMER_PLUS_MONTHLY_PRICE_ID",
    displayName: "Consumer Plus",
    featureSummary: [
      "More monthly loyalty points",
      "Enhanced member rewards",
      "Early access perks",
    ],
  },
  {
    planKey: "consumer_plus_annual",
    tier: "Plus",
    billingCycle: "annual",
    envKey: "STRIPE_CONSUMER_PLUS_ANNUAL_PRICE_ID",
    displayName: "Consumer Plus",
    featureSummary: [
      "More monthly loyalty points",
      "Enhanced member rewards",
      "Early access perks",
    ],
  },
  {
    planKey: "consumer_vip_monthly",
    tier: "VIP",
    billingCycle: "monthly",
    envKey: "STRIPE_CONSUMER_VIP_MONTHLY_PRICE_ID",
    displayName: "Consumer VIP",
    featureSummary: [
      "Highest monthly loyalty points",
      "Best perks and rewards",
      "Priority member support",
    ],
  },
  {
    planKey: "consumer_vip_annual",
    tier: "VIP",
    billingCycle: "annual",
    envKey: "STRIPE_CONSUMER_VIP_ANNUAL_PRICE_ID",
    displayName: "Consumer VIP",
    featureSummary: [
      "Highest monthly loyalty points",
      "Best perks and rewards",
      "Priority member support",
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
      billingCycle: plan.billingCycle,
      priceId,
      displayName: plan.displayName,
      featureSummary: plan.featureSummary,
    });
  }

  return {
    plans,
    hasConsumerPlans: plans.length > 0,
    missingEnv,
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
    billingCycle: match.billingCycle,
  };
}
