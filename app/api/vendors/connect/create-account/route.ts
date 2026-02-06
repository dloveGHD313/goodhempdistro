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
export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const route = "/api/vendors/connect/create-account";
  const responseHeaders = { "X-Request-Id": requestId, "Cache-Control": "no-store" };
  let safeUserId: string | null = null;
  const json = (payload: Record<string, unknown>, status = 200) =>
    NextResponse.json(
      { ...payload, requestId },
      { status, headers: responseHeaders }
    );

  try {
    assertStripeLiveConfig();
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      console.warn("[vendor-connect] unauthorized", { route, requestId });
      return json({ ok: false, code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
    }
    safeUserId = user.id;

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
        message: insertError.message?.slice(0, 300),
      });
      return json({ ok: false, code: "CONNECT_ACCOUNT_SAVE_FAILED", error: "Failed to save Connect account" }, 500);
    }

    return json({
      ok: true,
      stripe_account_id: account.id,
    });
  } catch (e: unknown) {
    const err = e as { type?: string; code?: string; message?: string; requestId?: string; statusCode?: number };
    const errorMessage =
      typeof err?.message === "string" ? err.message.slice(0, 300) : "Unknown error";
    const errorType = typeof err?.type === "string" ? err.type : undefined;
    const errorCode = typeof err?.code === "string" ? err.code : undefined;
    const stripeRequestId =
      typeof err?.requestId === "string" ? err.requestId : undefined;
    console.error("[vendor-connect] create-account failed", {
      route,
      requestId,
      userId: safeUserId,
      stripeRequestId,
      errorType,
      errorCode,
      message: errorMessage,
    });
    return json(
      {
        ok: false,
        code: "CONNECT_ACCOUNT_CREATE_FAILED",
        error: "Failed to create Connect account",
        diagnosticReason: errorType || errorCode,
        stripeRequestId,
      },
      500
    );
  }
}
