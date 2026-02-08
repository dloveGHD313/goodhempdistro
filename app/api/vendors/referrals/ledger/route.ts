import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireVendorActive } from "@/lib/server/vendorStatusGate";

/**
 * GET /api/vendors/referrals/ledger — list ledger entries for current vendor (referrer).
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
    return NextResponse.json({ entries: [] });
  }

  const { data: entries, error } = await supabase
    .from("vendor_referral_ledger")
    .select("id, amount_cents, status, vendor_referral_id, order_id, metadata, created_at")
    .eq("referrer_vendor_id", vendor.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: entries ?? [] });
}
