import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireVendorActive } from "@/lib/server/vendorStatusGate";
import { stripe } from "@/lib/stripe";

const ROUTE_NAME = "vendors/connect/status";

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId };
}

/**
 * Get vendor Stripe Connect status.
 * Returns 200 with connected:false when no account or Stripe account invalid (no 500).
 */
export async function GET(req: NextRequest) {
  const requestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  try {
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

    const { data: row } = await supabase
      .from("vendor_connect_accounts")
      .select("stripe_account_id, charges_enabled, payouts_enabled, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row) {
      return NextResponse.json(
        {
          ok: true,
          connected: false,
          stripe_account_id: null,
          charges_enabled: false,
          payouts_enabled: false,
          requestId,
        },
        { status: 200, headers: requestIdHeaders(requestId) }
      );
    }

    try {
      const account = await stripe.accounts.retrieve(row.stripe_account_id);
      const chargesEnabled = account.charges_enabled ?? false;
      const payoutsEnabled = account.payouts_enabled ?? false;

      await supabase
        .from("vendor_connect_accounts")
        .update({
          charges_enabled: chargesEnabled,
          payouts_enabled: payoutsEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      return NextResponse.json({
        ok: true,
        connected: true,
        stripe_account_id: row.stripe_account_id,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        requestId,
      }, { headers: requestIdHeaders(requestId) });
    } catch (stripeErr: unknown) {
      const err = stripeErr as { code?: string; type?: string };
      if (err?.code === "account_invalid" || err?.type === "InvalidRequestError") {
        return NextResponse.json(
          {
            ok: true,
            connected: false,
            stripe_account_id: null,
            charges_enabled: false,
            payouts_enabled: false,
            error: "Stripe account no longer valid",
            requestId,
          },
          { status: 200, headers: requestIdHeaders(requestId) }
        );
      }
      throw stripeErr;
    }
  } catch (e) {
    console.error("[vendors/connect/status]", JSON.stringify({ requestId, route: ROUTE_NAME }));
    return NextResponse.json(
      { ok: false, error: "Failed to get Connect status", requestId },
      { status: 500, headers: requestIdHeaders(requestId) }
    );
  }
}
