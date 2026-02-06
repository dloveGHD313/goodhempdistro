import { getConsumerAccessStatus } from "@/lib/consumer-access";
import { getVendorAccessStatus } from "@/lib/vendor-access";

/**
 * Returns true if the user has access to full AI (paid consumer or active vendor or admin).
 * Free users get AskJAX navigation-only (intent-based links); full AI requires paid subscription.
 */
export async function requirePaidAI(userId: string, userEmail?: string | null): Promise<boolean> {
  const consumer = await getConsumerAccessStatus(userId, userEmail);
  if (consumer.isAdmin || consumer.isSubscribed) return true;
  const vendor = await getVendorAccessStatus(userId, userEmail);
  if (vendor.isSubscribed) return true;
  return false;
}
