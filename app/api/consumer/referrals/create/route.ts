import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getConsumerAccessStatus } from "@/lib/consumer-access";
import { getConsumerEntitlements } from "@/lib/consumer-plans";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getConsumerAccessStatus(user.id, user.email);
    if (!access.isSubscribed && !access.isAdmin) {
      return NextResponse.json({ error: "Subscription required" }, { status: 403 });
    }

    const entitlements = access.planKey ? getConsumerEntitlements(access.planKey) : null;
    if (!entitlements && !access.isAdmin) {
      return NextResponse.json({ error: "Plan not found" }, { status: 400 });
    }
    const rewardPoints = entitlements?.referralRewardPoints ?? 0;

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
