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
        { error: "No Connect account. Call create-account first.", code: "NO_CONNECT_ACCOUNT" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const siteUrl = getSiteUrl(req);
    const accountLink = await stripe.accountLinks.create({
      account: affiliate.stripe_account_id,
      refresh_url: `${siteUrl}/affiliate/portal?refresh=1`,
      return_url: `${siteUrl}/affiliate/portal?success=1`,
      type: "account_onboarding",
    });
    if (!accountLink.url) {
      const ref = `ref-${Date.now()}`;
      console.warn("[affiliates/connect/onboard-link] no url in accountLink", { ref });
      return NextResponse.json(
        { error: "Unable to get Stripe onboarding link. Please try again or contact support.", code: "ONBOARD_LINK_FAILED", ref },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json({
      ok: true,
      url: accountLink.url,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const ref = `ref-${Date.now()}`;
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[affiliates/connect/onboard-link] error", { ref, message: msg.slice(0, 200) });
    return NextResponse.json(
      { error: "Failed to create onboarding link. Please try again or contact support.", code: "ONBOARD_LINK_FAILED", ref },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
