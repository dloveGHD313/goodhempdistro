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
    const { data: loyalty, error: loyaltyError } = await admin
      .from("consumer_loyalty")
      .select("points_balance, lifetime_points_earned, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: events, error: eventsError } = await admin
      .from("consumer_loyalty_events")
      .select("id, event_type, points_delta, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (process.env.NODE_ENV !== "production" && (loyaltyError || eventsError)) {
      console.warn("[consumer/loyalty] load warnings", {
        loyaltyError,
        eventsError,
      });
    }

    return NextResponse.json(
      { loyalty: loyalty || null, events: events || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[consumer/loyalty] error", error);
    }
    return NextResponse.json(
      { error: "Failed to load loyalty balance" },
      { status: 500 }
    );
  }
}
