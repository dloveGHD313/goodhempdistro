import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * GET /api/vendors/referrals/payouts — list payout requests for current vendor referrer.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!vendor) {
    return NextResponse.json({ payouts: [] });
  }

  const { data: payouts, error } = await supabase
    .from("vendor_referral_payouts")
    .select("id, amount_cents, stripe_transfer_id, status, created_at, updated_at")
    .eq("referrer_vendor_id", vendor.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ payouts: payouts ?? [] });
}
