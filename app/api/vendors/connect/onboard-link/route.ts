import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";

const ROUTE_NAME = "vendors/connect/onboard-link";
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
  if (c === "account_invalid") return "Account setup issue; complete create-account first.";
  return undefined;
}

/**
 * Create Stripe Connect account onboarding link for vendor.
 * Account Links do NOT require STRIPE_CONNECT_CLIENT_ID (only OAuth does).
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
      return NextResponse.json(
        { error: "Unauthorized", requestId },
        { status: 401, headers: requestIdHeaders(requestId) }
      );
    }
    userId = user.id;

    const { data: row } = await supabase
      .from("vendor_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row?.stripe_account_id) {
      return NextResponse.json(
        { error: "No Connect account. Call create-account first.", requestId },
        { status: 400, headers: requestIdHeaders(requestId) }
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
    const err = e as { type?: string; code?: string; message?: string; requestId?: string; statusCode?: number };
    const msg = safeTruncate(err?.message ?? (e instanceof Error ? e.message : String(e)));
    console.error("[vendors/connect/onboard-link]", JSON.stringify({
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
        error: "Failed to create onboarding link",
        ...(errorReason && { errorReason }),
      },
      { status, headers: requestIdHeaders(requestId) }
    );
  }
}
