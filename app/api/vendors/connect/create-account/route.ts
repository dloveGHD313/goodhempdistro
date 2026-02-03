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

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId };
}

/** Safe user-facing reason for known Stripe errors; avoids leaking sensitive data. */
function safeErrorReason(err: { type?: string; code?: string }): string | undefined {
  const t = err?.type;
  const c = err?.code;
  if (t === "StripeInvalidRequestError" || t === "invalid_request_error") return "Invalid request to payment provider.";
  if (t === "StripeAuthenticationError" || t === "authentication_error") return "Payment provider authentication failed.";
  if (t === "StripeRateLimitError" || t === "rate_limit_error") return "Too many requests; try again shortly.";
  if (t === "StripeAPIError" || t === "api_error") return "Payment provider temporarily unavailable.";
  if (c === "account_invalid" || c === "account_already_exists") return "Account setup issue; contact support.";
  return undefined;
}

/**
 * Create Stripe Connect Express account for vendor (if not exists).
 * Account Links onboarding does NOT require STRIPE_CONNECT_CLIENT_ID (only OAuth does).
 */
export async function POST(_req: NextRequest) {
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
      return NextResponse.json(
        { error: "Unauthorized", requestId },
        { status: 401, headers: requestIdHeaders(requestId) }
      );
    }
    userId = user.id;

    const { data: existing } = await supabase
      .from("vendor_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.stripe_account_id) {
<<<<<<< HEAD
      return json({
        ok: true,
        stripe_account_id: existing.stripe_account_id,
        already_exists: true,
      });
=======
      return NextResponse.json(
        {
          ok: true,
          stripe_account_id: existing.stripe_account_id,
          already_exists: true,
          requestId,
        },
        { status: 200, headers: requestIdHeaders(requestId) }
      );
>>>>>>> 1cf9fe5 (fix: resolve vendor connect build error and finalize Stripe flow)
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
        { ok: false, requestId, error: "Failed to save Connect account" },
        { status: 500, headers: requestIdHeaders(requestId) }
      );
    }

    return NextResponse.json(
      { ok: true, stripe_account_id: account.id, requestId },
      { status: 200, headers: requestIdHeaders(requestId) }
    );
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
    const errorReason = safeErrorReason(err);
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: "Failed to create Connect account",
        ...(errorReason && { errorReason }),
      },
      { status, headers: requestIdHeaders(requestId) }
    );
  }
}
