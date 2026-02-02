import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";

const ROUTE_NAME = "vendors/connect/create-account";
const TRUNCATE = 300;

function safeTruncate(s: string | undefined): string | undefined {
  if (s == null || typeof s !== "string") return undefined;
  return s.length <= TRUNCATE ? s : s.slice(0, TRUNCATE) + "...";
}

/**
 * Create Stripe Connect Express account for vendor (if not exists).
 * Account Links onboarding does NOT require STRIPE_CONNECT_CLIENT_ID (only OAuth does).
 */
export async function POST(req: NextRequest) {
  const requestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  let userId: string | undefined;
  try {
    assertStripeLiveConfig();
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      console.warn("[vendor-connect] unauthorized", { route, requestId });
      return json({ error: "Unauthorized" }, 401);
    }
    userId = user.id;

    const { data: existing } = await supabase
      .from("vendor_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.stripe_account_id) {
      return json({
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
      console.error("[vendor-connect] save failed", {
        route,
        requestId,
        userId: safeUserId,
        stripeRequestId: undefined,
        errorType: "supabase_error",
        errorCode: insertError.code,
        message: insertError.message,
      });
      return json({ error: "Failed to save Connect account" }, 500);
    }

    return json({
      ok: true,
      stripe_account_id: account.id,
    });
  } catch (e: unknown) {
    const err = e as { type?: string; code?: string; message?: string; requestId?: string; statusCode?: number };
    const msg = safeTruncate(err?.message ?? (e instanceof Error ? e.message : String(e)));
    console.error("[vendors/connect/create-account]", JSON.stringify({
      requestId,
      route: ROUTE_NAME,
      userId: userId ?? null,
      errorType: err?.type ?? null,
      errorCode: err?.code ?? null,
      message: msg ?? null,
      stripeRequestId: err?.requestId ?? null,
    }));
    const status = typeof err?.statusCode === "number" ? err.statusCode : 500;
    return NextResponse.json(
      { ok: false, requestId, error: "Failed to create Connect account" },
      { status }
    );
  }
}
