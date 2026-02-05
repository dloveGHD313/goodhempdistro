import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";
import { getVendorPriceEnvStatus, getVendorPlanByPriceId, resolveVendorPriceId } from "@/lib/pricing";

const VENDOR_PLAN_KEYS = [
  "vendor_starter_monthly",
  "vendor_starter_annual",
  "vendor_pro_monthly",
  "vendor_pro_annual",
  "vendor_enterprise_monthly",
  "vendor_enterprise_annual",
] as const;

const ROUTE_NAME = "stripe/checkout";
const TRUNCATE = 300;

function safeTruncate(s: string | undefined): string | undefined {
  if (s == null || typeof s !== "string") return undefined;
  return s.length <= TRUNCATE ? s : s.slice(0, TRUNCATE) + "...";
}

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId };
}

function isStripeMissingCustomerError(err: unknown): boolean {
  const e = err as { code?: string; param?: string; message?: string };
  const code = e?.code;
  const param = e?.param;
  const msg = typeof e?.message === "string" ? e.message : "";
  return (
    (code === "resource_missing" && param === "customer") ||
    msg.includes("No such customer")
  );
}

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
  const requestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  let userId: string | undefined;
  try {
    assertStripeLiveConfig();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized", requestId, errorReason: "unauthorized" },
        { status: 401, headers: requestIdHeaders(requestId) }
      );
    }
    userId = user.id;

    const body = (await req.json().catch(() => ({}))) as CheckoutPayload;
    const productType = body.productType;
    const planKey = body.planKey;
    const cadence = body.cadence ?? body.billingInterval;
    const billingInterval = body.billingInterval ?? null;
    console.info("[stripe/checkout]", JSON.stringify({
      requestId,
      step: "start",
      productType: productType ?? null,
      planKey: planKey ?? null,
      cadence: cadence ?? null,
      billingInterval,
    }));
    if (body.productType !== "vendor") {
      return NextResponse.json(
        { error: "Vendor checkout requires productType: vendor", requestId },
        { status: 400, headers: requestIdHeaders(requestId) }
      );
    }
    if (!planKey || !cadence) {
      return NextResponse.json(
        { error: "Vendor checkout requires planKey and cadence", requestId },
        { status: 400, headers: requestIdHeaders(requestId) }
      );
    }
    const normalizedCadence = (cadence as string).toLowerCase();
    const validInterval = normalizedCadence === "annual" || normalizedCadence === "year" || normalizedCadence === "monthly" || normalizedCadence === "month";
    if (!VENDOR_PLAN_KEYS.includes(planKey as (typeof VENDOR_PLAN_KEYS)[number]) || !validInterval) {
      return NextResponse.json(
        { error: "Invalid vendor plan or billing interval", requestId },
        { status: 400, headers: requestIdHeaders(requestId) }
      );
    }
    console.info("[stripe/checkout]", JSON.stringify({ requestId, step: "parsed", planKey, cadence }));

    const { missingEnv, invalidEnv } = getVendorPriceEnvStatus();
    if (missingEnv.length > 0 || invalidEnv.length > 0) {
      console.warn("[stripe/checkout]", JSON.stringify({
        requestId,
        step: "env_fail",
        missingEnv,
        invalidEnv,
      }));
      return NextResponse.json(
        {
          error: "Vendor billing not configured",
          requestId,
          errorReason: "vendor_billing_not_configured",
          missingEnv,
          invalidEnv,
        },
        { status: 500, headers: requestIdHeaders(requestId) }
      );
    }
    const priceId = resolveVendorPriceId(planKey, cadence);
    const priceIdSuffix = priceId ? priceId.slice(-6) : null;
    console.info("[stripe/checkout]", JSON.stringify({
      requestId,
      step: "vendor_price_resolved",
      planKey,
      cadence,
      priceIdSuffix,
    }));
    if (!priceId || !priceId.startsWith("price_")) {
      console.info("[stripe/checkout]", JSON.stringify({ requestId, step: "vendor_price_missing", planKey, cadence }));
      return NextResponse.json(
        { error: "Invalid vendor plan selection", requestId },
        { status: 400, headers: requestIdHeaders(requestId) }
      );
    }
    const vendorPlan = getVendorPlanByPriceId(priceId);
    if (!vendorPlan) {
      return NextResponse.json(
        { error: "Invalid vendor plan selection", requestId },
        { status: 400, headers: requestIdHeaders(requestId) }
      );
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
        const { missingEnv: mEnv, invalidEnv: iEnv } = getVendorPriceEnvStatus();
        return NextResponse.json(
          {
            error: "Failed to provision vendor for checkout",
            requestId,
            errorReason: "vendor_provision_failed",
            missingEnv: mEnv,
            invalidEnv: iEnv,
          },
          { status: 500, headers: requestIdHeaders(requestId) }
        );
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
    console.info("[stripe/checkout]", JSON.stringify({
      requestId,
      step: "stripe_create_session_call",
      priceIdSuffix: priceId.slice(-6),
    }));
    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
    try {
      session = await stripe.checkout.sessions.create({
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
    } catch (stripeErr: unknown) {
      const se = stripeErr as { message?: string; code?: string; type?: string; requestId?: string };
      const safeMessage = safeTruncate(se?.message ?? (stripeErr instanceof Error ? stripeErr.message : String(stripeErr)));
      console.error("[stripe/checkout] stripe session create failed", JSON.stringify({
        requestId,
        planKey,
        cadence,
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

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "consumer") {
      await admin
        .from("profiles")
        .update({ role: "vendor_pending" })
        .eq("id", user.id);
    }

    return NextResponse.json(
      { url: session.url, requestId },
      { status: 200, headers: requestIdHeaders(requestId) }
    );
  } catch (error: unknown) {
    const err = error as {
      name?: string;
      type?: string;
      code?: string;
      message?: string;
      requestId?: string;
      statusCode?: number;
    };
    const msg = safeTruncate(
      err?.message ?? (error instanceof Error ? error.message : String(error))
    );
    console.error("[stripe/checkout]", JSON.stringify({
      requestId,
      route: ROUTE_NAME,
      errName: err?.name ?? (error instanceof Error ? error.name : null),
      errorType: err?.type ?? null,
      errorCode: err?.code ?? null,
      statusCode: err?.statusCode ?? null,
      message: msg ?? null,
      stripeRequestId: err?.requestId ?? null,
    }));
    const isStripeError = Boolean(err?.type ?? err?.code ?? err?.requestId);
    const rawMessage = error instanceof Error ? error.message : String(error);
    const isConfigError = typeof rawMessage === "string" && rawMessage.includes("Stripe production config");
    const errorReason = isStripeError
      ? "Stripe rejected request"
      : isConfigError
        ? "Stripe config missing or invalid"
        : "Server error";
    const payload: { error: string; requestId: string; errorReason?: string; stripeRequestId?: string } = {
      error: "Failed to create checkout session",
      requestId,
      errorReason,
    };
    if (err?.requestId) payload.stripeRequestId = err.requestId;
    return NextResponse.json(
      payload,
      { status: 500, headers: requestIdHeaders(requestId) }
    );
  }
}
