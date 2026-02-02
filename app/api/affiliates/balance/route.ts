import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * GET /api/affiliates/balance — available balance (sum of affiliate_ledger where status = 'available').
 * Uses admin to run raw sum; then we verify affiliate belongs to current user.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!affiliate) {
    return NextResponse.json({ available_cents: 0, total_earned_cents: 0 });
  }

  const admin = getSupabaseAdminClient();

  const { data: available } = await admin
    .from("affiliate_ledger")
    .select("amount_cents")
    .eq("affiliate_id", affiliate.id)
    .eq("status", "available");

  const { data: allEarned } = await admin
    .from("affiliate_ledger")
    .select("amount_cents")
    .eq("affiliate_id", affiliate.id)
    .in("status", ["available", "paid"]);

  const available_cents = (available ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const total_earned_cents = (allEarned ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);

  return NextResponse.json({ available_cents, total_earned_cents });
}
