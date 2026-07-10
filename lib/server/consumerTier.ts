/**
 * Server-side consumer tier resolution (perks spec 2026-07-10).
 * Split from lib/entitlements.ts so that module stays pure and importable
 * by client components (perk matrix UI).
 */

import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isConsumerSubscriptionActive } from "@/lib/consumer-access";
import {
  TIER_ENTITLEMENTS,
  planKeyToTier,
  type ConsumerTier,
  type TierEntitlements,
} from "@/lib/entitlements";

/**
 * Resolve a user's consumer tier from their consumer_subscriptions row.
 * Only an ACTIVE subscription (active/trialing) grants a paid tier.
 * Uses the admin client — callers include webhooks and crons where no
 * user session exists. Fails closed to Free on any error.
 */
export async function resolveConsumerTier(userId: string): Promise<ConsumerTier> {
  if (!userId) return "Free";
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("consumer_subscriptions")
      .select("subscription_status, consumer_plan_key")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return "Free";
    if (!isConsumerSubscriptionActive(data.subscription_status)) return "Free";
    return planKeyToTier(data.consumer_plan_key);
  } catch {
    return "Free";
  }
}

/** Convenience: tier + entitlements in one call. */
export async function resolveConsumerEntitlements(
  userId: string
): Promise<{ tier: ConsumerTier; entitlements: TierEntitlements }> {
  const tier = await resolveConsumerTier(userId);
  return { tier, entitlements: TIER_ENTITLEMENTS[tier] };
}
