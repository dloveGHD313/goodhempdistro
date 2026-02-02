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
        { error: "Affiliate record not found. Use /affiliate first to get your code." },
        { status: 400 }
      );
    }

    if (affiliate.stripe_account_id) {
      return NextResponse.json({
        ok: true,
        stripe_account_id: affiliate.stripe_account_id,
        already_exists: true,
      });
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

    const { error: updateError } = await supabase
      .from("affiliates")
      .update({
        stripe_account_id: account.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", affiliate.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to save Connect account" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      stripe_account_id: account.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Failed to create Connect account" },
      { status: 500 }
    );
  }
}
