import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";
import { requireApprovedDriver } from "@/lib/server/driverStatusGate";

const ROUTE_NAME = "driver/connect/onboard-link";

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId };
}

function truncateMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message.length <= 300 ? message : `${message.slice(0, 300)}...`;
}

export async function POST(req: NextRequest) {
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

    const { data: row } = await supabase
      .from("drivers")
      .select("stripe_account_id")
      .eq("id", driverCheck.driverId)
      .maybeSingle();

    if (!row?.stripe_account_id) {
      return NextResponse.json(
        { ok: false, error: "No Stripe account yet. Call create-account first.", requestId },
        { status: 409, headers: requestIdHeaders(requestId) }
      );
    }

    const siteUrl = getSiteUrl(req);
    const accountLink = await stripe.accountLinks.create({
      account: row.stripe_account_id,
      refresh_url: `${siteUrl}/driver/dashboard?connect_retry=1`,
      return_url: `${siteUrl}/driver/dashboard?connect_success=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({ ok: true, url: accountLink.url, requestId }, { headers: requestIdHeaders(requestId) });
  } catch (error: unknown) {
    const err = error as { type?: string; code?: string; message?: string; requestId?: string };
    console.error(
      "[driver/connect/onboard-link]",
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
