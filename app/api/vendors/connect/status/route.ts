import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

/**
 * Get vendor Stripe Connect status.
 * Requires vendor session.
 */
export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const route = "/api/vendors/connect/status";
  const responseHeaders = { "X-Request-Id": requestId };
  let safeUserId: string | null = null;
  const json = (payload: Record<string, unknown>, status = 200) =>
    NextResponse.json(
      { ...payload, requestId },
      { status, headers: responseHeaders }
    );

  try {
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
      .select("stripe_account_id, charges_enabled, payouts_enabled, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row) {
      return json({
        ok: true,
        connected: false,
        stripe_account_id: null,
        charges_enabled: false,
        payouts_enabled: false,
      });
    }

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

    return json({
      ok: true,
      connected: true,
      stripe_account_id: row.stripe_account_id,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
    });
  } catch (e) {
    const err = e as { type?: string; code?: string; message?: string; requestId?: string };
    const errorMessage =
      typeof err?.message === "string" ? err.message.slice(0, 300) : "Unknown error";
    const errorType = typeof err?.type === "string" ? err.type : undefined;
    const errorCode = typeof err?.code === "string" ? err.code : undefined;
    const stripeRequestId =
      typeof err?.requestId === "string" ? err.requestId : undefined;
    console.error("[vendor-connect] status failed", {
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
        error: "Failed to get Connect status",
        diagnosticReason: errorType || errorCode,
        stripeRequestId,
      },
      500
    );
  }
}
