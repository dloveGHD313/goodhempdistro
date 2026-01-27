export const LOYALTY_MULTIPLIERS = {
  Starter: 1.0,
  Plus: 1.5,
  VIP: 2.0,
} as const;

export const REFERRAL_REWARD_POINTS = {
  Starter: 250,
  Plus: 500,
  VIP: 1000,
} as const;

export const SUBSCRIPTION_BONUS_POINTS = 500;

export const BASE_POINTS_PER_DOLLAR = 1;

export function getLoyaltyMultiplier(tier: keyof typeof LOYALTY_MULTIPLIERS) {
  return LOYALTY_MULTIPLIERS[tier];
}

export function getReferralRewardPoints(tier: keyof typeof REFERRAL_REWARD_POINTS) {
  return REFERRAL_REWARD_POINTS[tier];
}

export function getSubscriptionBonusPoints(): number {
  return SUBSCRIPTION_BONUS_POINTS;
}

export function calculatePurchasePoints(amountCents: number, multiplier: number) {
  const basePoints = Math.floor((amountCents / 100) * BASE_POINTS_PER_DOLLAR);
  return Math.round(basePoints * multiplier);
}
