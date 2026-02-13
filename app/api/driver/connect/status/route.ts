import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { requireApprovedDriver } from "@/lib/server/driverStatusGate";

const ROUTE_NAME = "driver/connect/status";

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId, "Cache-Control": "no-store" };
}

function truncateMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message.length <= 300 ? message : `${message.slice(0, 300)}...`;
}

export async function GET(_req: NextRequest) {
  const requestId = crypto.randomUUID();
  let safeUserId: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized", requestId }, { status: 401, headers: requestIdHeaders(requestId) });
    }
    safeUserId = user.id;

    const driverCheck = await requireApprovedDriver(user.id);
    if (!driverCheck.allowed) {
      return NextResponse.json(
        { ok: false, ...driverCheck.json, requestId },
        { status: driverCheck.status, headers: requestIdHeaders(requestId) }
      );
    }

    const { data: row } = await supabase
      .from("drivers")
      .select("stripe_account_id, charges_enabled, payouts_enabled")
      .eq("id", driverCheck.driverId)
      .maybeSingle();

    if (!row?.stripe_account_id) {
      return NextResponse.json(
        {
          ok: true,
          connected: false,
          stripe_account_id: null,
          details_submitted: false,
          charges_enabled: false,
          payouts_enabled: false,
          payout_ready: false,
          requestId,
        },
        { headers: requestIdHeaders(requestId) }
      );
    }

    const account = await stripe.accounts.retrieve(row.stripe_account_id);
    const detailsSubmitted = account.details_submitted ?? false;
    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;

    await supabase
      .from("drivers")
      .update({
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        connect_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", driverCheck.driverId);

    return NextResponse.json(
      {
        ok: true,
        connected: true,
        stripe_account_id: row.stripe_account_id,
        details_submitted: detailsSubmitted,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        payout_ready: Boolean(detailsSubmitted && chargesEnabled && payoutsEnabled),
        requestId,
      },
      { headers: requestIdHeaders(requestId) }
    );
  } catch (error: unknown) {
    const err = error as { type?: string; code?: string; message?: string; requestId?: string };
    console.error(
      "[driver/connect/status]",
      JSON.stringify({
        route: ROUTE_NAME,
        requestId,
        userId: safeUserId,
        errorType: err?.type ?? null,
        errorCode: err?.code ?? null,
        message: truncateMessage(err?.message ?? (error instanceof Error ? error.message : String(error))) ?? null,
        stripeRequestId: err?.requestId ?? null,
      })
    );

    return NextResponse.json({ ok: false, requestId }, { status: 500, headers: requestIdHeaders(requestId) });
  }
}
