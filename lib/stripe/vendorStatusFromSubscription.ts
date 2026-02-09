/**
 * SSOT: Stripe subscription status → profiles.vendor_status.
 * Used by webhook only. Allowed values: "pending" | "active" | null.
 */

export const VENDOR_ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

/**
 * Desired profiles.vendor_status from Stripe subscription status.
 * Active/trialing => "active". Otherwise preserve current (webhook never sets pending/null).
 */
export function getDesiredVendorStatusFromSubscription(
  subscriptionStatus: string | null,
  currentVendorStatus: "pending" | "active" | null
): "pending" | "active" | null {
  if (subscriptionStatus && VENDOR_ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) return "active";
  return currentVendorStatus;
}
