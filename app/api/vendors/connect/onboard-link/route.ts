import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe, getSiteUrl } from "@/lib/stripe";

/**
 * Create Stripe Connect account onboarding link for vendor.
 * Requires vendor session and existing Connect account (create-account first).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: row } = await supabase
      .from("vendor_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row?.stripe_account_id) {
      return NextResponse.json(
        { error: "No Connect account. Call create-account first." },
        { status: 400 }
      );
    }

    const siteUrl = getSiteUrl(req);
    const accountLink = await stripe.accountLinks.create({
      account: row.stripe_account_id,
      refresh_url: `${siteUrl}/vendors/payouts?refresh=1`,
      return_url: `${siteUrl}/vendors/payouts?success=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      ok: true,
      url: accountLink.url,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Failed to create onboarding link" },
      { status: 500 }
    );
  }
}
