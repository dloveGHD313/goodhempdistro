import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";

/**
 * Create Stripe Connect account onboarding link for affiliate.
 * Requires affiliate session and existing Connect account (create-account first).
 */
export async function POST(req: NextRequest) {
  try {
    assertStripeLiveConfig();
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
      return NextResponse.json(
        { error: "No Connect account. Call create-account first." },
        { status: 400 }
      );
    }

    const siteUrl = getSiteUrl(req);
    const accountLink = await stripe.accountLinks.create({
      account: affiliate.stripe_account_id,
      refresh_url: `${siteUrl}/affiliate/portal?refresh=1`,
      return_url: `${siteUrl}/affiliate/portal?success=1`,
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
