import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";

const ROUTE_NAME = "affiliates/connect/onboard-link";

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId, "Cache-Control": "no-store" };
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

    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!affiliate) {
      return NextResponse.json({ ok: false, error: "Affiliate record not found.", requestId }, { status: 400, headers: requestIdHeaders(requestId) });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.stripe_account_id) {
      return NextResponse.json(
        { ok: false, error: "No Connect account. Call create-account first.", requestId },
        { status: 400, headers: requestIdHeaders(requestId) }
      );
    }

    const siteUrl = getSiteUrl(req);
    const accountLink = await stripe.accountLinks.create({
      account: profile.stripe_account_id,
      refresh_url: `${siteUrl}/affiliate/portal?refresh=1`,
      return_url: `${siteUrl}/affiliate/portal?success=1`,
      type: "account_onboarding",
    });

    if (!accountLink.url) {
      return NextResponse.json(
        { ok: false, error: "Unable to get Stripe onboarding link.", requestId },
        { status: 500, headers: requestIdHeaders(requestId) }
      );
    }

    return NextResponse.json({ ok: true, url: accountLink.url, requestId }, { headers: requestIdHeaders(requestId) });
  } catch (error: unknown) {
    const err = error as { type?: string; code?: string; message?: string; requestId?: string };
    console.error(
      "[affiliates/connect/onboard-link]",
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
