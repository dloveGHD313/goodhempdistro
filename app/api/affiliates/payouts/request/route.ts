import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * POST /api/affiliates/payouts/request — create a payout request (status 'requested').
 * Body: { amount_cents: number }. Amount must not exceed available balance.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!affiliate) {
    return NextResponse.json({ error: "Affiliate record not found" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: availableRows } = await admin
    .from("affiliate_ledger")
    .select("amount_cents")
    .eq("affiliate_id", affiliate.id)
    .eq("status", "available");

  const available_cents = (availableRows ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  if (amount_cents > available_cents) {
    return NextResponse.json(
      { error: `Amount exceeds available balance (${available_cents}¢)` },
      { status: 400 }
    );
  }

  const { data: payout, error } = await admin
    .from("affiliate_payouts")
    .insert({
      affiliate_id: affiliate.id,
      amount_cents,
      status: "requested",
    })
    .select("id, amount_cents, status, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, payout });
}
