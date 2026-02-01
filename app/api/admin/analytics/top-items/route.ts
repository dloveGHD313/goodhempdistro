import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * Admin analytics: top items by GMV. Query: ?type=product|service|event_ticket|vendor_slot
 */
export async function GET(req: NextRequest) {
  try {
    const { user, isAdmin } = await requireAdminUsers(req);
    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "product";

    const admin = getSupabaseAdminClient();

    const { data: items } = await admin
      .from("order_items")
      .select("item_id, item_type, line_total_cents, order_id")
      .eq("item_type", type);

    const { data: paidOrders } = await admin
      .from("orders")
      .select("id")
      .eq("status", "paid");
    const paidSet = new Set((paidOrders || []).map((o) => o.id));

    const byItem: Record<string, number> = {};
    for (const item of items || []) {
      if (!paidSet.has(item.order_id)) continue;
      const id = (item.item_id as string) || "unknown";
      byItem[id] = (byItem[id] || 0) + Number(item.line_total_cents ?? 0);
    }

    const entries = Object.entries(byItem)
      .map(([item_id, gmv_cents]) => ({ item_id, gmv_cents }))
      .sort((a, b) => b.gmv_cents - a.gmv_cents)
      .slice(0, 20);

    return NextResponse.json({ ok: true, type, data: entries });
  } catch (e) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
