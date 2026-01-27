import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getConsumerAccessStatus } from "@/lib/consumer-access";
import { getConsumerEntitlements } from "@/lib/consumer-plans";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getVendorAccessStatus } from "@/lib/vendor-access";
import { REFERRAL_SIGNUP_BONUS_POINTS } from "@/lib/consumer-loyalty";
import { isReferralLinkEligible, isStarterConsumerPlanKey } from "@/lib/referral-eligibility";

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
        { error: "Referral links are only available to Starter consumers or vendors." },
        { status: 403 }
      );
    }

    const entitlements = access.planKey ? getConsumerEntitlements(access.planKey) : null;
    const isStarter = isStarterConsumerPlanKey(access.planKey);
    const rewardPoints = isStarter
      ? entitlements?.referralRewardPoints ?? REFERRAL_SIGNUP_BONUS_POINTS
      : REFERRAL_SIGNUP_BONUS_POINTS;

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
