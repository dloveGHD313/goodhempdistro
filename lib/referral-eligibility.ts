export function isStarterConsumerPlanKey(planKey?: string | null) {
  return Boolean(planKey && planKey.startsWith("consumer_starter_"));
}

export function isReferralLinkEligible(params: {
  isAdmin: boolean;
  consumerPlanKey?: string | null;
  isVendorSubscribed: boolean;
}) {
  if (params.isAdmin) {
    return true;
  }
  if (params.isVendorSubscribed) {
    return true;
  }
  return isStarterConsumerPlanKey(params.consumerPlanKey);
}
