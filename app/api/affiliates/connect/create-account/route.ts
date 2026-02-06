import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";

/**
 * Create Stripe Connect Express account for affiliate (if not exists).
 * Stores stripe_account_id on affiliates table. Requires affiliate session.
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

    if (!affiliate) {
      return NextResponse.json(
        { error: "Affiliate record not found. Use /affiliate first to get your code.", code: "AFFILIATE_NOT_FOUND" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (affiliate.stripe_account_id) {
      return NextResponse.json({
        ok: true,
        stripe_account_id: affiliate.stripe_account_id,
        already_exists: true,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: user.email ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { user_id: user.id, affiliate_id: affiliate.id },
    });
    console.info("[affiliates/connect/create-account] account created", { accountId: account.id?.slice(0, 12) });

    const { error: updateError } = await supabase
      .from("affiliates")
      .update({
        stripe_account_id: account.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", affiliate.id);

    if (updateError) {
      const ref = `ref-${Date.now()}`;
      console.warn("[affiliates/connect/create-account] update failed", { ref, message: updateError.message });
      return NextResponse.json(
        { error: "Failed to save Connect account. Please try again or contact support.", code: "CONNECT_SAVE_FAILED", ref },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json({
      ok: true,
      stripe_account_id: account.id,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const ref = `ref-${Date.now()}`;
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[affiliates/connect/create-account] error", { ref, message: msg.slice(0, 200) });
    return NextResponse.json(
      { error: "Failed to create Connect account. Please try again or contact support.", code: "CONNECT_CREATE_FAILED", ref },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
