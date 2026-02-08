import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireVendorActive } from "@/lib/server/vendorStatusGate";

/**
 * POST /api/vendors/referrals/payouts/request — create payout request (status requested).
 */
export async function POST(req: NextRequest) {
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

  let body: { amount_cents?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amount_cents = typeof body.amount_cents === "number" ? Math.floor(body.amount_cents) : 0;
  if (amount_cents <= 0) {
    return NextResponse.json({ error: "amount_cents must be a positive number" }, { status: 400 });
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!vendor) {
    return NextResponse.json({ error: "Vendor account required" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: availableRows } = await admin
    .from("vendor_referral_ledger")
    .select("amount_cents")
    .eq("referrer_vendor_id", vendor.id)
    .eq("status", "available");

  const available_cents = (availableRows ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  if (amount_cents > available_cents) {
    return NextResponse.json(
      { error: `Amount exceeds available balance (${available_cents}¢)` },
      { status: 400 }
    );
  }

  const { data: payout, error } = await admin
    .from("vendor_referral_payouts")
    .insert({
      referrer_vendor_id: vendor.id,
      amount_cents,
      status: "requested",
    })
    .select("id, amount_cents, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, payout });
}
