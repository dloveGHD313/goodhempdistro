import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireVendorActive } from "@/lib/server/vendorStatusGate";

/**
 * GET /api/vendors/referrals/code — get or create referral code for current vendor.
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
    return NextResponse.json(
      { error: "Vendor account required" },
      { status: 400 }
    );
  }

  const { data: referrer } = await supabase
    .from("vendor_referrers")
    .select("id, referral_code")
    .eq("vendor_id", vendor.id)
    .maybeSingle();

  if (referrer) {
    return NextResponse.json({ referral_code: referrer.referral_code });
  }

  const code = `${vendor.id.slice(0, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const admin = getSupabaseAdminClient();

  const { data: created, error } = await admin
    .from("vendor_referrers")
    .insert({ vendor_id: vendor.id, referral_code: code })
    .select("referral_code")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await admin
        .from("vendor_referrers")
        .select("referral_code")
        .eq("vendor_id", vendor.id)
        .maybeSingle();
      return NextResponse.json({ referral_code: existing?.referral_code ?? code });
    }
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ referral_code: created?.referral_code ?? code });
}
