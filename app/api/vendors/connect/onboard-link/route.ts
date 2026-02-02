import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";

/**
 * Create Stripe Connect account onboarding link for vendor.
 * Requires vendor session and existing Connect account (create-account first).
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_CONNECT_CLIENT_ID?.trim()) {
      throw new Error("STRIPE_CONNECT_CLIENT_ID is required for Stripe Connect.");
    }
    assertStripeLiveConfig();
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
      refresh_url: `${siteUrl}/vendors/payouts?retry=1`,
      return_url: `${siteUrl}/vendors/payouts?connected=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      ok: true,
      url: accountLink.url,
    });
  } catch (e: unknown) {
    console.error("Vendor Connect onboard-link failed", e);
    const err = e as { type?: string; code?: string; message?: string; requestId?: string; statusCode?: number };
    const status = typeof err?.statusCode === "number" ? err.statusCode : 500;
    return NextResponse.json(
      {
        error: "Failed to create onboarding link",
        details: {
          type: typeof err?.type === "string" ? err.type : undefined,
          code: typeof err?.code === "string" ? err.code : undefined,
          message: typeof err?.message === "string" ? err.message : undefined,
          requestId: typeof err?.requestId === "string" ? err.requestId : undefined,
        },
      },
      { status }
    );
  }
}
