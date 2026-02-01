import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * Admin analytics: top vendors by GMV and by platform fees.
 */
export async function GET(req: NextRequest) {
  try {
    const { user, isAdmin } = await requireAdminUsers(req);
    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();

    const { data: items } = await admin
      .from("order_items")
      .select("vendor_user_id, line_total_cents, platform_fee_cents, order_id")
      .not("vendor_user_id", "is", null);

    const { data: paidOrders } = await admin
      .from("orders")
      .select("id")
      .eq("status", "paid");
    const paidSet = new Set((paidOrders || []).map((o) => o.id));

    const byVendor: Record<string, { gmv_cents: number; fee_cents: number }> = {};
    for (const item of items || []) {
      if (!paidSet.has(item.order_id)) continue;
      const uid = item.vendor_user_id as string;
      if (!byVendor[uid]) byVendor[uid] = { gmv_cents: 0, fee_cents: 0 };
      byVendor[uid].gmv_cents += Number(item.line_total_cents ?? 0);
      byVendor[uid].fee_cents += Number(item.platform_fee_cents ?? 0);
    }

    const vendorIds = Object.keys(byVendor);
    const { data: vendors } =
      vendorIds.length > 0
        ? await admin
            .from("vendors")
            .select("owner_user_id, business_name")
            .in("owner_user_id", vendorIds)
        : { data: [] };

    const nameByUser: Record<string, string> = {};
    for (const v of vendors || []) {
      nameByUser[(v as { owner_user_id: string }).owner_user_id] =
        (v as { business_name?: string }).business_name || "—";
    }

    const top = Object.entries(byVendor)
      .map(([uid, v]) => ({
        vendor_user_id: uid,
        business_name: nameByUser[uid] || uid.slice(0, 8),
        gmv_cents: v.gmv_cents,
        fee_cents: v.fee_cents,
      }))
      .sort((a, b) => b.gmv_cents - a.gmv_cents)
      .slice(0, 20);

    return NextResponse.json({ ok: true, data: top });
  } catch (e) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
