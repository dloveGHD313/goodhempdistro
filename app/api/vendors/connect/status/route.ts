import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

/**
 * Get vendor Stripe Connect status.
 * Requires vendor session.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: row } = await supabase
      .from("vendor_connect_accounts")
      .select("stripe_account_id, charges_enabled, payouts_enabled, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({
        ok: true,
        connected: false,
        stripe_account_id: null,
        charges_enabled: false,
        payouts_enabled: false,
      });
    }

    const account = await stripe.accounts.retrieve(row.stripe_account_id);
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;

    await supabase
      .from("vendor_connect_accounts")
      .update({
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      ok: true,
      connected: true,
      stripe_account_id: row.stripe_account_id,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to get Connect status" },
      { status: 500 }
    );
  }
}
