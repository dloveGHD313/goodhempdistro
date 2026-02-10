import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";
import { requireApprovedDriver } from "@/lib/server/driverStatusGate";

const ROUTE_NAME = "driver/connect/create-account";

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId };
}

function truncateMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message.length <= 300 ? message : `${message.slice(0, 300)}...`;
}

export async function POST(_req: NextRequest) {
  const requestId = crypto.randomUUID();
  let safeUserId: string | null = null;

  try {
    assertStripeLiveConfig();
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

    const { data: existing } = await supabase
      .from("drivers")
      .select("stripe_account_id")
      .eq("id", driverCheck.driverId)
      .maybeSingle();

    if (existing?.stripe_account_id) {
      return NextResponse.json(
        { ok: true, stripe_account_id: existing.stripe_account_id, already_exists: true, requestId },
        { headers: requestIdHeaders(requestId) }
      );
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: user.email ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { user_id: user.id, driver_id: driverCheck.driverId },
    });

    const { error: updateError } = await supabase
      .from("drivers")
      .update({
        stripe_account_id: account.id,
        charges_enabled: false,
        payouts_enabled: false,
        connect_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", driverCheck.driverId);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: "Failed to save Connect account", requestId },
        { status: 500, headers: requestIdHeaders(requestId) }
      );
    }

    return NextResponse.json({ ok: true, stripe_account_id: account.id, requestId }, { headers: requestIdHeaders(requestId) });
  } catch (error: unknown) {
    const err = error as { type?: string; code?: string; message?: string; requestId?: string };
    console.error(
      "[driver/connect/create-account]",
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
