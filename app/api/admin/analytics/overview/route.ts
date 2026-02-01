import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * Admin analytics overview: GMV, platform revenue, orders count, AOV.
 * Uses admin_users table for auth.
 */
export async function GET(req: NextRequest) {
  try {
    const { user, isAdmin } = await requireAdminUsers(req);
    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();

    const { data: orders } = await admin
      .from("orders")
      .select("id, total_cents, status")
      .eq("status", "paid");

    const orderIds = (orders || []).map((o) => o.id);
    let platformFeeTotal = 0;
    let lineTotalSum = 0;

    if (orderIds.length > 0) {
      const { data: items } = await admin
        .from("order_items")
        .select("line_total_cents, platform_fee_cents")
        .in("order_id", orderIds);

      for (const item of items || []) {
        lineTotalSum += Number(item.line_total_cents ?? 0);
        platformFeeTotal += Number(item.platform_fee_cents ?? 0);
      }
    }

    const count = orders?.length ?? 0;
    const gmvCents = lineTotalSum;
    const aovCents = count > 0 ? Math.round(gmvCents / count) : 0;

    return NextResponse.json({
      ok: true,
      gmv_cents: gmvCents,
      platform_revenue_cents: platformFeeTotal,
      orders_count: count,
      aov_cents: aovCents,
    });
  } catch (e) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
