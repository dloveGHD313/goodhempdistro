export function isStarterConsumerPlanKey(planKey?: string | null) {
  return Boolean(planKey && planKey.startsWith("consumer_starter_"));
}

/**
 * Perks spec 2026-07-10: every consumer tier earns referral rewards
 * (Free 100 / Basic 250 / Plus 500 / Premium 1000 points, × the tier's
 * earn multiplier — see lib/entitlements.ts), so referral links are open
 * to all signed-in users. The old Starter-only consumer gate predates the
 * tier matrix.
 */
export function isReferralLinkEligible(_params: {
  isAdmin: boolean;
  consumerPlanKey?: string | null;
  isVendorSubscribed: boolean;
}) {
  return true;
}
