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

export const POINT_VALUE_CENTS = 1;
export const SUBSCRIPTION_BONUS_POINTS = 500;
export const REFERRAL_SIGNUP_BONUS_POINTS = 1;
export const BASE_POINTS_PER_DOLLAR = 2;
export const HIGH_SPEND_THRESHOLD_DOLLARS = 100;
export const HIGH_SPEND_MULTIPLIER = 3;
export const BONUS_POINTS_PER_100_SPENT = 100;

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
  const dollars = Math.floor(amountCents / 100);
  const basePoints = dollars * BASE_POINTS_PER_DOLLAR;
  const purchaseMultiplier =
    dollars >= HIGH_SPEND_THRESHOLD_DOLLARS ? HIGH_SPEND_MULTIPLIER : 1;
  return Math.round(basePoints * purchaseMultiplier * multiplier);
}

export function getSpendMilestonesToAward(
  totalSpendCents: number,
  awardedMilestones: number[]
) {
  const totalMilestones = Math.floor(totalSpendCents / 10000);
  if (totalMilestones <= 0) {
    return [];
  }
  const awardedSet = new Set(awardedMilestones);
  const pending: number[] = [];
  for (let milestone = 1; milestone <= totalMilestones; milestone += 1) {
    if (!awardedSet.has(milestone)) {
      pending.push(milestone);
    }
  }
  return pending;
}
