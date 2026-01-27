import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getConsumerAccessStatus } from "@/lib/consumer-access";

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const points = Number(body?.points || 0);
    if (!Number.isFinite(points) || points <= 0) {
      return NextResponse.json(
        { error: "Points must be a positive number" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("consumer_loyalty_redeem", {
      p_user_id: user.id,
      p_points: Math.floor(points),
      p_metadata: { reason: body?.reason || "redeem" },
    });

    if (error) {
      const status = error.message?.includes("INSUFFICIENT_POINTS") ? 400 : 500;
      return NextResponse.json(
        { error: status === 400 ? "Insufficient points" : "Failed to redeem points" },
        { status }
      );
    }

    return NextResponse.json(
      { loyalty: data?.[0] || null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[consumer/loyalty/redeem] error", error);
    }
    return NextResponse.json(
      { error: "Failed to redeem points" },
      { status: 500 }
    );
  }
}
