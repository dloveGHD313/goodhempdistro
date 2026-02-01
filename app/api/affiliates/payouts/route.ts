import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * GET /api/affiliates/payouts — list payout requests for current affiliate.
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
    return NextResponse.json({ payouts: [] });
  }

  const { data: payouts, error } = await supabase
    .from("affiliate_payouts")
    .select("id, amount_cents, stripe_transfer_id, status, created_at, updated_at")
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ payouts: payouts ?? [] });
}
