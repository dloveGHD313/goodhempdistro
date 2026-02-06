import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";
import { getVendorPlanByPriceId } from "@/lib/pricing";

type CheckoutPayload = {
  productType?: string;
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
  const responseHeaders = { "X-Request-Id": requestId, "Cache-Control": "no-store" };
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
      return json({ ok: false, code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
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
      return json({ ok: false, code: "INVALID_PRICE_SELECTION", error: msg }, 400);
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
      return json({ ok: false, code: "INVALID_VENDOR_PRICE", error: "Invalid vendor price selection" }, 400);
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
        console.error("[stripe/checkout] vendor provision failed", JSON.stringify({
          requestId,
          userId: user.id,
          error: insertErr?.message ?? String(insertErr),
          code: insertErr?.code ?? null,
          details: insertErr?.details ?? null,
        }));
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
        return json({ ok: false, code: "VENDOR_PROVISION_FAILED", error: "Failed to provision vendor for checkout" }, 500);
      }
    }

    let stripeCustomerId = vendor.stripe_customer_id || null;
    const hadStoredCustomerId = Boolean(vendor.stripe_customer_id);
    let oldCustomerSuffixForLog: string | null = null;

    if (stripeCustomerId) {
      try {
        const retrieved = await stripe.customers.retrieve(stripeCustomerId);
        const deleted = (retrieved as { deleted?: boolean }).deleted === true;
        if (deleted) {
          oldCustomerSuffixForLog = stripeCustomerId.slice(-8);
          stripeCustomerId = null;
        }
      } catch (retrieveErr: unknown) {
        if (isStripeMissingCustomerError(retrieveErr)) {
          oldCustomerSuffixForLog = stripeCustomerId.slice(-8);
          stripeCustomerId = null;
        } else {
          throw retrieveErr;
        }
      }
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: vendor.business_name || undefined,
        metadata: {
          user_id: user.id,
          plan_type: "vendor",
          vendor_id: vendor.id,
        },
      });
      stripeCustomerId = customer.id;
      await admin
        .from("vendors")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", vendor.id);
      if (hadStoredCustomerId && oldCustomerSuffixForLog) {
        console.warn("[stripe/checkout] recovered_missing_customer", JSON.stringify({
          requestId,
          oldCustomerSuffix: oldCustomerSuffixForLog,
          newCustomerSuffix: customer.id.slice(-8),
        }));
      }
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
    } catch (stripeErr: unknown) {
      const se = stripeErr as { message?: string; code?: string; type?: string; requestId?: string };
      const safeMessage = safeTruncate(se?.message ?? (stripeErr instanceof Error ? stripeErr.message : String(stripeErr)));
      console.error("[stripe/checkout] stripe session create failed", JSON.stringify({
        requestId,
        planKey,
        cadence: normalizedCadence,
        priceIdSuffix: priceId.slice(-6),
        stripeCustomerId: stripeCustomerId?.slice(-8) ?? null,
        stripeErrorCode: se?.code ?? null,
        stripeErrorType: se?.type ?? null,
        stripeRequestId: se?.requestId ?? null,
        message: safeMessage,
      }));
      return NextResponse.json(
        {
          error: "Could not start checkout. Please try again.",
          requestId,
          errorReason: "stripe_session_create_failed",
        },
        { status: 500, headers: requestIdHeaders(requestId) }
      );
    }
    console.info("[stripe/checkout]", JSON.stringify({
      requestId,
      step: "stripe_create_session_ok",
      sessionIdSuffix: session.id.slice(-6),
    }));

    return json({ ok: true, url: session.url });
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
        ok: false,
        code: "CHECKOUT_SESSION_CREATE_FAILED",
        error: "Failed to create checkout session",
        diagnosticReason: errorType || errorCode,
        stripeRequestId,
      },
      500
    );
  }
}
