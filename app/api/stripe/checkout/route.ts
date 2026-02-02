import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { stripe, getSiteUrl, resolvePriceId } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";
import { getVendorPlanByPriceId } from "@/lib/pricing";

type CheckoutPayload = {
  priceId?: string;
  planKey?: string;
  billingInterval?: string;
  tier?: string;
  cadence?: string;
  productLimit?: number | null;
  commission?: number | null;
};

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const route = "/api/stripe/checkout";
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
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("[stripe-checkout] unauthorized", { route, requestId });
      return json({ error: "Unauthorized" }, 401);
    }
    safeUserId = user.id;

    const body = (await req.json().catch(() => ({}))) as CheckoutPayload;
    let priceId: string;
    try {
      priceId = resolvePriceId({
        priceId: body.priceId,
        planKey: body.planKey,
        billingInterval: body.billingInterval,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Missing price selection";
      console.warn("[stripe-checkout] invalid price selection", {
        route,
        requestId,
        userId: safeUserId,
        stripeRequestId: undefined,
        errorType: "invalid_request",
        errorCode: undefined,
        message: msg.slice(0, 300),
      });
      return json({ error: msg }, 400);
    }

    const vendorPlan = getVendorPlanByPriceId(priceId);
    if (!vendorPlan) {
      console.warn("[stripe-checkout] non-vendor price rejected", {
        route,
        requestId,
        userId: safeUserId,
        stripeRequestId: undefined,
        errorType: "invalid_request",
        errorCode: undefined,
        message: "PriceId not mapped to a vendor plan",
      });
      return json({ error: "Invalid vendor price selection" }, 400);
    }

    const admin = getSupabaseAdminClient();
    let vendor = (
      await admin
        .from("vendors")
        .select("id, owner_user_id, business_name, stripe_customer_id")
        .eq("owner_user_id", user.id)
        .maybeSingle()
    ).data;

    if (!vendor) {
      const { data: application } = await admin
        .from("vendor_applications")
        .select("business_name")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      const businessName =
        (application?.business_name?.trim()) || user.email || "Vendor";
      const { data: inserted, error: insertErr } = await admin
        .from("vendors")
        .insert({
          owner_user_id: user.id,
          business_name: businessName,
          status: "active",
        })
        .select("id, owner_user_id, business_name, stripe_customer_id")
        .single();
      if (insertErr) {
        const { data: existing } = await admin
          .from("vendors")
          .select("id, owner_user_id, business_name, stripe_customer_id")
          .eq("owner_user_id", user.id)
          .maybeSingle();
        vendor = existing ?? null;
      } else {
        vendor = inserted ?? null;
      }
      if (!vendor) {
        console.error("[stripe-checkout] vendor provision failed", {
          route,
          requestId,
          userId: safeUserId,
          stripeRequestId: undefined,
          errorType: "supabase_error",
          errorCode: insertErr?.code,
          message: insertErr?.message?.slice(0, 300) ?? "Vendor provision failed",
        });
        return json({ error: "Failed to provision vendor for checkout" }, 500);
      }
    }

    let stripeCustomerId = vendor.stripe_customer_id || null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: vendor.business_name || undefined,
        metadata: {
          user_id: user.id,
          vendor_id: vendor.id,
        },
      });
      stripeCustomerId = customer.id;
      await admin
        .from("vendors")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", vendor.id);
    }

    const siteUrl = getSiteUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing?tab=vendor`,
      client_reference_id: user.id,
      metadata: {
        plan_key: body.planKey || "",
        tier: body.tier || "",
        cadence: body.cadence || "",
        product_limit:
          body.productLimit === null || body.productLimit === undefined
            ? ""
            : String(body.productLimit),
        commission:
          body.commission === null || body.commission === undefined
            ? ""
            : String(body.commission),
        price_id: priceId,
        plan_type: "vendor",
        vendor_id: vendor.id,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          plan_key: body.planKey || "",
          tier: body.tier || "",
          cadence: body.cadence || "",
          price_id: priceId,
          plan_type: "vendor",
          vendor_id: vendor.id,
          user_id: user.id,
        },
      },
    });

    return json({ url: session.url });
  } catch (error) {
    const err = error as {
      type?: string;
      code?: string;
      message?: string;
      requestId?: string;
      statusCode?: number;
    };
    const errorMessage =
      typeof err?.message === "string" ? err.message.slice(0, 300) : "Unknown error";
    const errorType = typeof err?.type === "string" ? err.type : undefined;
    const errorCode = typeof err?.code === "string" ? err.code : undefined;
    const stripeRequestId =
      typeof err?.requestId === "string" ? err.requestId : undefined;
    console.error("[stripe-checkout] vendor checkout failed", {
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
        error: "Failed to create checkout session",
        diagnosticReason: errorType || errorCode,
        stripeRequestId,
      },
      500
    );
  }
}
