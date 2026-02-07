import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireVendorActive } from "@/lib/server/vendorStatusGate";

/**
 * GET /api/vendors/referrals/balance — available and total earned for current vendor referrer.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const vendorStatusResult = await requireVendorActive(user.id, user.email);
  if (!vendorStatusResult.allowed) {
    return NextResponse.json(vendorStatusResult.json, { status: vendorStatusResult.status });
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!vendor) {
    return NextResponse.json({ available_cents: 0, total_earned_cents: 0 });
  }

  const admin = getSupabaseAdminClient();

  const { data: available } = await admin
    .from("vendor_referral_ledger")
    .select("amount_cents")
    .eq("referrer_vendor_id", vendor.id)
    .eq("status", "available");

  const { data: allEarned } = await admin
    .from("vendor_referral_ledger")
    .select("amount_cents")
    .eq("referrer_vendor_id", vendor.id)
    .in("status", ["available", "paid"]);

  const available_cents = (available ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const total_earned_cents = (allEarned ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);

  return NextResponse.json({ available_cents, total_earned_cents });
}
