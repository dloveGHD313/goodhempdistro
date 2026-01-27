import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getConsumerAccessStatus } from "@/lib/consumer-access";

export async function GET() {
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

    const admin = getSupabaseAdminClient();
    const { data: referrals, error } = await admin
      .from("consumer_referrals")
      .select("id, referral_code, referred_user_id, reward_points, reward_status, created_at")
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load referrals" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { referrals: referrals || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[consumer/referrals] error", error);
    }
    return NextResponse.json(
      { error: "Failed to load referrals" },
      { status: 500 }
    );
  }
}
