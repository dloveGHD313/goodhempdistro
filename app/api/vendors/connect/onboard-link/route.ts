import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";

/**
 * Create Stripe Connect account onboarding link for vendor.
 * Requires vendor session and existing Connect account (create-account first).
 */
export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const route = "/api/vendors/connect/onboard-link";
  const responseHeaders = { "X-Request-Id": requestId };
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
      return json({ error: "Unauthorized" }, 401);
    }
    safeUserId = user.id;

    const { data: row } = await supabase
      .from("vendor_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row?.stripe_account_id) {
      console.warn("[vendor-connect] missing account", {
        route,
        requestId,
        userId: safeUserId,
        stripeRequestId: undefined,
        errorType: "invalid_request",
        errorCode: undefined,
        message: "No Connect account",
      });
      return json({ error: "No Connect account. Call create-account first." }, 409);
    }

    const siteUrl = getSiteUrl(req);
    const accountLink = await stripe.accountLinks.create({
      account: row.stripe_account_id,
      refresh_url: `${siteUrl}/vendors/payouts?retry=1`,
      return_url: `${siteUrl}/vendors/payouts?connected=1`,
      type: "account_onboarding",
    });

    return json({
      ok: true,
      url: accountLink.url,
    });
  } catch (e: unknown) {
    const err = e as { type?: string; code?: string; message?: string; requestId?: string; statusCode?: number };
    const errorMessage =
      typeof err?.message === "string" ? err.message.slice(0, 300) : "Unknown error";
    const errorType = typeof err?.type === "string" ? err.type : undefined;
    const errorCode = typeof err?.code === "string" ? err.code : undefined;
    const stripeRequestId =
      typeof err?.requestId === "string" ? err.requestId : undefined;
    console.error("[vendor-connect] onboard-link failed", {
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
        error: "Failed to create onboarding link",
        diagnosticReason: errorType || errorCode,
        stripeRequestId,
      },
      500
    );
  }
}
