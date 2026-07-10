import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getConsumerAccessStatus } from "@/lib/consumer-access";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getVendorAccessStatus } from "@/lib/vendor-access";
import { resolveConsumerEntitlements } from "@/lib/entitlements";
import { isReferralLinkEligible } from "@/lib/referral-eligibility";

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getConsumerAccessStatus(user.id, user.email);
    const vendorAccess = await getVendorAccessStatus(user.id, user.email);
    const isAdmin = access.isAdmin || vendorAccess.isAdmin;
    const eligible = isReferralLinkEligible({
      isAdmin,
      consumerPlanKey: access.planKey,
      isVendorSubscribed: vendorAccess.isSubscribed,
    });

    if (!eligible) {
      return NextResponse.json(
        { error: "Referral links are not available for this account." },
        { status: 403 }
      );
    }

    // Perks spec 2026-07-10: reward = tier's referralRewardPoints × its
    // referralEarnMultiplier (verification #3: Plus → 500 × 1.5 = 750).
    // Stored here for display; the grant path recomputes from the
    // referrer's tier at grant time, which is authoritative.
    const { entitlements } = await resolveConsumerEntitlements(user.id);
    const rewardPoints = Math.round(
      entitlements.referralRewardPoints * entitlements.referralEarnMultiplier
    );

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("consumer_referrals_create", {
      p_referrer_user_id: user.id,
      p_reward_points: rewardPoints,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to create referral code" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { referral: data?.[0] || null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[consumer/referrals/create] error", error);
    }
    return NextResponse.json(
      { error: "Failed to create referral code" },
      { status: 500 }
    );
  }
}
