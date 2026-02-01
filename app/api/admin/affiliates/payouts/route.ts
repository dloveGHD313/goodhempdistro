import { NextResponse } from "next/server";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { NextRequest } from "next/server";

/**
 * GET /api/admin/affiliates/payouts — list affiliate payouts (requested first).
 * Admin only (admin_users).
 */
export async function GET(req: NextRequest) {
  const { isAdmin } = await requireAdminUsers(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();

  const { data: payouts, error } = await admin
    .from("affiliate_payouts")
    .select("id, affiliate_id, amount_cents, stripe_transfer_id, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const rows = payouts ?? [];
  const affiliateIds = [...new Set(rows.map((p) => p.affiliate_id))];
  const { data: affiliates } = await admin
    .from("affiliates")
    .select("id, affiliate_code, stripe_account_id")
    .in("id", affiliateIds);

  const affiliateMap = new Map((affiliates ?? []).map((a) => [a.id, a]));
  const payoutsWithAffiliate = rows.map((p) => ({
    ...p,
    affiliate_code: affiliateMap.get(p.affiliate_id)?.affiliate_code ?? null,
    stripe_account_id: affiliateMap.get(p.affiliate_id)?.stripe_account_id ?? null,
  }));

  return NextResponse.json({ payouts: payoutsWithAffiliate });
}
