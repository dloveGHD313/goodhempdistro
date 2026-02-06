import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

/**
 * Get affiliate Stripe Connect status.
 * Requires affiliate session.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id, stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!affiliate?.stripe_account_id) {
      return NextResponse.json({
        ok: true,
        connected: false,
        stripe_account_id: null,
        charges_enabled: false,
        payouts_enabled: false,
      });
    }

    const account = await stripe.accounts.retrieve(affiliate.stripe_account_id);
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;

    return NextResponse.json({
      ok: true,
      connected: true,
      stripe_account_id: affiliate.stripe_account_id,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
    });
  } catch (e) {
    const ref = `ref-${Date.now()}`;
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[affiliates/connect/status] error", { ref, message: msg.slice(0, 200) });
    return NextResponse.json(
      { error: "Failed to get Connect status.", code: "CONNECT_STATUS_FAILED", ref },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
