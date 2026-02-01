import { NextResponse } from "next/server";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { NextRequest } from "next/server";

/**
 * GET /api/admin/vendor-referrals/payouts — list vendor referral payouts (admin).
 */
export async function GET(req: NextRequest) {
  const { isAdmin } = await requireAdminUsers(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();

  const { data: payouts, error } = await admin
    .from("vendor_referral_payouts")
    .select("id, referrer_vendor_id, amount_cents, stripe_transfer_id, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = payouts ?? [];
  const vendorIds = [...new Set(rows.map((p) => p.referrer_vendor_id))];
  const { data: referrers } = await admin
    .from("vendor_referrers")
    .select("vendor_id, referral_code")
    .in("vendor_id", vendorIds);
  const { data: vendors } = await admin
    .from("vendors")
    .select("id, owner_user_id, business_name")
    .in("id", vendorIds);
  const { data: connect } = await admin
    .from("vendor_connect_accounts")
    .select("user_id, stripe_account_id")
    .in("user_id", (vendors ?? []).map((v) => v.owner_user_id));

  const connectByUser = new Map((connect ?? []).map((c) => [c.user_id, c]));
  const vendorById = new Map((vendors ?? []).map((v) => [v.id, v]));
  const referrerByVendor = new Map((referrers ?? []).map((r) => [r.vendor_id, r]));

  const payoutsWithMeta = rows.map((p) => {
    const v = vendorById.get(p.referrer_vendor_id);
    const conn = v ? connectByUser.get(v.owner_user_id) : null;
    return {
      ...p,
      referral_code: referrerByVendor.get(p.referrer_vendor_id)?.referral_code ?? null,
      business_name: v?.business_name ?? null,
      stripe_account_id: conn?.stripe_account_id ?? null,
    };
  });

  return NextResponse.json({ payouts: payoutsWithMeta });
}
