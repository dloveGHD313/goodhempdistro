import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";

/**
 * Create Stripe Connect Express account for vendor (if not exists).
 * Requires vendor session.
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

    const { data: existing } = await supabase
      .from("vendor_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.stripe_account_id) {
      return NextResponse.json({
        ok: true,
        stripe_account_id: existing.stripe_account_id,
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
      metadata: { user_id: user.id },
    });

    const { error: insertError } = await supabase
      .from("vendor_connect_accounts")
      .upsert(
        {
          user_id: user.id,
          stripe_account_id: account.id,
          charges_enabled: false,
          payouts_enabled: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save Connect account" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      stripe_account_id: account.id,
    });
  } catch (e: unknown) {
    console.error("Vendor Connect create-account failed", e);
    const err = e as { type?: string; code?: string; message?: string; requestId?: string; statusCode?: number };
    const status = typeof err?.statusCode === "number" ? err.statusCode : 500;
    return NextResponse.json(
      {
        error: "Failed to create Connect account",
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
