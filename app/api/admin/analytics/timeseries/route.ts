import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * Admin analytics time series: daily (30d) or monthly (12m).
 * Query: ?bucket=daily|monthly
 */
export async function GET(req: NextRequest) {
  try {
    const { user, isAdmin } = await requireAdminUsers(req);
    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket") || "daily";

    const admin = getSupabaseAdminClient();

    const { data: orders } = await admin
      .from("orders")
      .select("id, total_cents, paid_at")
      .eq("status", "paid")
      .not("paid_at", "is", null);

    const orderIds = (orders || []).map((o) => o.id);
    const feeByOrder: Record<string, number> = {};
    if (orderIds.length > 0) {
      const { data: items } = await admin
        .from("order_items")
        .select("order_id, line_total_cents, platform_fee_cents")
        .in("order_id", orderIds);
      for (const item of items || []) {
        const oid = item.order_id;
        feeByOrder[oid] = (feeByOrder[oid] || 0) + Number(item.platform_fee_cents ?? 0);
      }
    }

    const byKey: Record<string, { gmv_cents: number; fee_cents: number; count: number }> = {};

    for (const o of orders || []) {
      const paidAt = o.paid_at;
      if (!paidAt) continue;
      const d = new Date(paidAt);
      const key =
        bucket === "monthly"
          ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
          : paidAt.slice(0, 10);
      if (!byKey[key]) byKey[key] = { gmv_cents: 0, fee_cents: 0, count: 0 };
      byKey[key].gmv_cents += Number(o.total_cents ?? 0);
      byKey[key].fee_cents += feeByOrder[o.id] ?? 0;
      byKey[key].count += 1;
    }

    const series = Object.entries(byKey)
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ ok: true, series });
  } catch (e) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
