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
  description: string;
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
  description: string;
};

const CONSUMER_PLAN_ENVS: ConsumerPlanEnv[] = [
  {
    planKey: "consumer_starter_monthly",
    tier: "Starter",
    cadence: "monthly",
    billingInterval: "month",
    envKey: "STRIPE_CONSUMER_STARTER_MONTHLY_PRICE_ID",
    displayName: "Consumer Starter",
    priceText: "$5.99/month",
    loyaltyMultiplier: 1.0,
    referralRewardPoints: 250,
    imageUrl: "/images/consumer-plans/consumer-starter-monthly.png",
    imageAlt: "Consumer Starter monthly plan",
    description:
      "Starter access to Good Hemp Distro perks. Earn loyalty points on purchases, get subscriber-only offers, and enjoy member rewards across the marketplace. Perfect for everyday shoppers who want savings and simple perks.",
  },
  {
    planKey: "consumer_starter_annual",
    tier: "Starter",
    cadence: "annual",
    billingInterval: "year",
    envKey: "STRIPE_CONSUMER_STARTER_ANNUAL_PRICE_ID",
    displayName: "Consumer Starter",
    priceText: "$64.69/year",
    loyaltyMultiplier: 1.0,
    referralRewardPoints: 250,
    imageUrl: "/images/consumer-plans/consumer-starter-annual.png",
    imageAlt: "Consumer Starter annual plan",
    description:
      "Best value for starters—save 10% annually. Earn loyalty points, access subscriber-only offers, and enjoy member rewards all year long. Great for consistent shoppers who want steady perks and savings.",
  },
  {
    planKey: "consumer_plus_monthly",
    tier: "Plus",
    cadence: "monthly",
    billingInterval: "month",
    envKey: "STRIPE_CONSUMER_PLUS_MONTHLY_PRICE_ID",
    displayName: "Consumer Plus",
    priceText: "$7.99/month",
    loyaltyMultiplier: 1.5,
    referralRewardPoints: 500,
    imageUrl: "/images/consumer-plans/consumer-plus-monthly.png",
    imageAlt: "Consumer Plus monthly plan",
    description:
      "Upgrade your perks with boosted rewards. Earn higher loyalty points, unlock member-only offers, and get early access to drops. Includes priority shipping/delivery and an enhanced referral bonus you can use as credits or payouts.",
  },
  {
    planKey: "consumer_plus_annual",
    tier: "Plus",
    cadence: "annual",
    billingInterval: "year",
    envKey: "STRIPE_CONSUMER_PLUS_ANNUAL_PRICE_ID",
    displayName: "Consumer Plus",
    priceText: "$86.29/year",
    loyaltyMultiplier: 1.5,
    referralRewardPoints: 500,
    imageUrl: "/images/consumer-plans/consumer-plus-annual.png",
    imageAlt: "Consumer Plus annual plan",
    description:
      "Lock in Plus perks for a full year and save 10%. Higher loyalty rewards, member-only offers, early access to drops, priority shipping/delivery, and an upgraded referral bonus you can redeem as credits or payouts.",
  },
  {
    planKey: "consumer_vip_monthly",
    tier: "VIP",
    cadence: "monthly",
    billingInterval: "month",
    envKey: "STRIPE_CONSUMER_VIP_MONTHLY_PRICE_ID",
    displayName: "Consumer VIP",
    priceText: "$12.99/month",
    loyaltyMultiplier: 2.0,
    referralRewardPoints: 1000,
    imageUrl: "/images/consumer-plans/consumer-vip-monthly.png",
    imageAlt: "Consumer VIP monthly plan",
    description:
      "The ultimate membership. Highest loyalty multiplier, exclusive VIP deals, free delivery on eligible Good Hemp Distro products, and priority ticketing for events. Includes premium referral bonuses plus top-tier perks every month.",
  },
  {
    planKey: "consumer_vip_annual",
    tier: "VIP",
    cadence: "annual",
    billingInterval: "year",
    envKey: "STRIPE_CONSUMER_VIP_ANNUAL_PRICE_ID",
    displayName: "Consumer VIP",
    priceText: "$140.29/year",
    loyaltyMultiplier: 2.0,
    referralRewardPoints: 1000,
    imageUrl: "/images/consumer-plans/consumer-vip-annual.png",
    imageAlt: "Consumer VIP annual plan",
    description:
      "Go VIP for a year and save 10%. Highest loyalty rewards, VIP-only deals, free delivery on eligible products, and priority event ticketing. Includes premium referral bonuses and the strongest perks we offer.",
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
      description: plan.description,
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
    billingInterval: match.billingInterval,
    loyaltyMultiplier: match.loyaltyMultiplier,
    referralRewardPoints: match.referralRewardPoints,
  };
}
