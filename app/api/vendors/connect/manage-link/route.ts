import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireVendorActive } from "@/lib/server/vendorStatusGate";
import { stripe } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";

/**
 * Generate a Stripe Express dashboard login link for an onboarded vendor.
 *
 * Companion to /api/vendors/connect/onboard-link (which serves type="account_onboarding"
 * for first-time KYC). This route serves the management URL used after onboarding
 * completes — vendors visit it to update bank info, change payout schedule, view
 * payout history, etc. Stripe handles all of that UX on their hosted dashboard.
 *
 * Returns 404 (not 500) if the vendor has no Connect account yet — UI should
 * route them to onboarding instead.
 */

const ROUTE_NAME = "vendors/connect/manage-link";

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId };
}

export async function POST(_req: NextRequest) {
  const requestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  try {
    assertStripeLiveConfig();

    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", requestId },
        { status: 401, headers: requestIdHeaders(requestId) }
      );
    }

    const vendorStatusResult = await requireVendorActive(user.id, user.email);
    if (!vendorStatusResult.allowed) {
      return NextResponse.json(
        { ok: false, ...vendorStatusResult.json, requestId },
        { status: vendorStatusResult.status, headers: requestIdHeaders(requestId) }
      );
    }

    const { data: connect } = await supabase
      .from("vendor_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!connect?.stripe_account_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "No connected account. Complete onboarding first.",
          requestId,
        },
        { status: 404, headers: requestIdHeaders(requestId) }
      );
    }

    // Stripe API: accounts.createLoginLink → returns one-time URL into the
    // Express dashboard for this Connect account. URL expires after ~5 minutes
    // and is single-use; users should refresh from this endpoint each time.
    const loginLink = await stripe.accounts.createLoginLink(connect.stripe_account_id);

    return NextResponse.json(
      { ok: true, url: loginLink.url, requestId },
      { headers: { ...requestIdHeaders(requestId), "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${ROUTE_NAME}] error`, { message, requestId });
    return NextResponse.json(
      { ok: false, error: "Failed to generate manage link", requestId },
      { status: 500, headers: requestIdHeaders(requestId) }
    );
  }
}
