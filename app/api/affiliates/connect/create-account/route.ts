import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";

const ROUTE_NAME = "affiliates/connect/create-account";

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId, "Cache-Control": "no-store" };
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

    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!affiliate) {
      return NextResponse.json(
        { ok: false, error: "Affiliate record not found. Use /affiliate first to get your code.", requestId },
        { status: 400, headers: requestIdHeaders(requestId) }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.stripe_account_id) {
      return NextResponse.json(
        {
          ok: true,
          stripeAccountId: profile.stripe_account_id,
          stripe_account_id: profile.stripe_account_id,
          already_exists: true,
          requestId,
        },
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
      metadata: { user_id: user.id, affiliate_id: affiliate.id },
    });

    const now = new Date().toISOString();
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({
        stripe_account_id: account.id,
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
        connect_updated_at: now,
        updated_at: now,
      })
      .eq("id", user.id);

    if (updateProfileError) {
      return NextResponse.json(
        { ok: false, error: "Failed to save Connect account.", requestId },
        { status: 500, headers: requestIdHeaders(requestId) }
      );
    }

    // Best-effort compatibility sync for environments that still use affiliates.stripe_account_id.
    await supabase
      .from("affiliates")
      .update({ stripe_account_id: account.id, updated_at: now })
      .eq("id", affiliate.id);

    return NextResponse.json(
      {
        ok: true,
        stripeAccountId: account.id,
        stripe_account_id: account.id,
        requestId,
      },
      { headers: requestIdHeaders(requestId) }
    );
  } catch (error: unknown) {
    const err = error as { type?: string; code?: string; message?: string; requestId?: string };
    console.error(
      "[affiliates/connect/create-account]",
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
