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

export function getLoyaltyMultiplier(tier: keyof typeof LOYALTY_MULTIPLIERS) {
  return LOYALTY_MULTIPLIERS[tier];
}

export function getReferralRewardPoints(tier: keyof typeof REFERRAL_REWARD_POINTS) {
  return REFERRAL_REWARD_POINTS[tier];
}

export function getSubscriptionBonusPoints(): number {
  // TODO: Define subscription bonus points per tier or plan.
  return 0;
}

export function calculatePurchasePoints(amountCents: number, multiplier: number) {
  // TODO: Confirm base points per dollar. Current default: 1 point per $1.
  const basePoints = Math.floor(amountCents / 100);
  return Math.round(basePoints * multiplier);
}
