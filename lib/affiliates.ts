/**
 * Affiliate System Helpers
 * Generate referral codes, track referrals, calculate rewards
 */

import { createSupabaseServerClient } from "./supabase";

/**
 * Generate a unique affiliate code for a user
 */
export function generateAffiliateCode(userId: string): string {
  // Use first 8 chars of user ID + random suffix
  const userPart = userId.slice(0, 8).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${userPart}-${randomPart}`;
}

/**
 * Calculate affiliate reward based on package tier
 * STARTER -> $5, PLUS -> $15, VIP -> $25
 */
export function calculateAffiliateReward(packageName: string): number {
  const rewards: Record<string, number> = {
    STARTER: 500, // $5.00
    PLUS: 1500, // $15.00
    VIP: 2500, // $25.00
    BASIC: 500, // vendor packages also get rewards
    PRO: 1500,
    ELITE: 2500,
  };
  return rewards[packageName.toUpperCase()] || 500;
}

/**
 * Create or retrieve affiliate record for a user
 */
export async function ensureAffiliate(userId: string, role: "consumer" | "vendor") {
  const supabase = await createSupabaseServerClient();

  // Check if affiliate exists
  const { data: existing } = await supabase
    .from("affiliates")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) {
    return existing;
  }

  // Create new affiliate
  const affiliateCode = generateAffiliateCode(userId);
  const { data: newAffiliate, error } = await supabase
    .from("affiliates")
    .insert({
      user_id: userId,
      role,
      affiliate_code: affiliateCode,
      reward_cents: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating affiliate:", error);
    throw error;
  }

  return newAffiliate;
}

/**
 * Track a referral when a new user signs up via affiliate link
 */
export async function trackReferral(
  affiliateCode: string,
  referredUserId: string
) {
  const supabase = await createSupabaseServerClient();

  // Find affiliate by code
  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id")
    .eq("affiliate_code", affiliateCode)
    .single();

  if (!affiliate) {
    console.warn(`Affiliate code not found: ${affiliateCode}`);
    return null;
  }

  // Create referral record
  const { data: referral, error } = await supabase
    .from("affiliate_referrals")
    .insert({
      affiliate_id: affiliate.id,
      referred_user_id: referredUserId,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error tracking referral:", error);
    return null;
  }

  return referral;
}

/**
 * Get affiliate earnings summary
 */
export async function getAffiliateEarnings(userId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select(`
      *,
      referrals:affiliate_referrals(*)
    `)
    .eq("user_id", userId)
    .single();

  if (!affiliate) {
    return {
      totalReferrals: 0,
      paidReferrals: 0,
      pendingReferrals: 0,
      totalEarnings: 0,
    };
  }

  const referrals = affiliate.referrals || [];
  const paidReferrals = referrals.filter((r: any) => r.status === "paid");
  const pendingReferrals = referrals.filter((r: any) => r.status === "pending");

  return {
    totalReferrals: referrals.length,
    paidReferrals: paidReferrals.length,
    pendingReferrals: pendingReferrals.length,
    totalEarnings: affiliate.reward_cents,
    affiliateCode: affiliate.affiliate_code,
  };
}
