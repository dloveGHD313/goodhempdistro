import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";
import { getVendorPlanConfigs, getVendorPlanByPriceId, resolveVendorPriceId } from "@/lib/pricing";

const ROUTE_NAME = "stripe/checkout";
const TRUNCATE = 300;

function safeTruncate(s: string | undefined): string | undefined {
  if (s == null || typeof s !== "string") return undefined;
  return s.length <= TRUNCATE ? s : s.slice(0, TRUNCATE) + "...";
}

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId };
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
        { error: "Unauthorized", requestId },
        { status: 401, headers: requestIdHeaders(requestId) }
      );
    }
    userId = user.id;

    const body = (await req.json().catch(() => ({}))) as CheckoutPayload;
    if (body.productType !== "vendor") {
      return NextResponse.json(
        { error: "Vendor checkout requires productType: vendor", requestId },
        { status: 400, headers: requestIdHeaders(requestId) }
      );
    }
    const cadence = body.cadence ?? body.billingInterval;
    const planKey = body.planKey;
    if (!planKey || !cadence) {
      return NextResponse.json(
        { error: "Vendor checkout requires planKey and cadence", requestId },
        { status: 400, headers: requestIdHeaders(requestId) }
      );
    }
    const { invalidEnv, missingEnv } = getVendorPlanConfigs();
    if (invalidEnv.length > 0) {
      console.warn("[stripe/checkout] invalid vendor price env (not price_ prefix)", { requestId, invalidEnvKeys: invalidEnv });
      return NextResponse.json(
        {
          error: "Vendor pricing is misconfigured",
          requestId,
          details: {
            productType: "vendor",
            planKey: planKey ?? null,
            cadence: cadence ?? null,
            missingEnvKeys: missingEnv,
            invalidEnvKeys: invalidEnv,
            resolvedPriceIdPrefix: "invalid" as const,
          },
        },
        { status: 500, headers: requestIdHeaders(requestId) }
      );
    }
    const priceId = resolveVendorPriceId(planKey, cadence);
    const resolvedPriceIdPrefix = !priceId ? "missing" : priceId.startsWith("price_") ? "price_" : "invalid";
    if (!priceId || !priceId.startsWith("price_")) {
      return NextResponse.json(
        {
          error: "Invalid vendor price selection",
          requestId,
          details: {
            productType: "vendor",
            planKey: planKey ?? null,
            cadence: cadence ?? null,
            missingEnvKeys: missingEnv,
            invalidEnvKeys: invalidEnv,
            resolvedPriceIdPrefix,
          },
        },
        { status: 400, headers: requestIdHeaders(requestId) }
      );
    }
    const vendorPlan = getVendorPlanByPriceId(priceId);
    if (!vendorPlan) {
      return NextResponse.json(
        {
          error: "Invalid vendor price selection",
          requestId,
          details: {
            productType: "vendor",
            planKey: planKey ?? null,
            cadence: cadence ?? null,
            missingEnvKeys: missingEnv,
            invalidEnvKeys: invalidEnv,
            resolvedPriceIdPrefix: "price_" as const,
          },
        },
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
        const { missingEnv: mEnv, invalidEnv: iEnv } = getVendorPlanConfigs();
        return NextResponse.json(
          {
            error: "Failed to provision vendor for checkout",
            requestId,
            details: {
              productType: "vendor",
              planKey: body.planKey ?? null,
              cadence: cadence ?? null,
              missingEnvKeys: mEnv,
              invalidEnvKeys: iEnv,
              resolvedPriceIdPrefix: "price_" as const,
            },
          },
          { status: 500, headers: requestIdHeaders(requestId) }
        );
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
      userId: userId ?? null,
      errorType: err?.type ?? null,
      errorCode: err?.code ?? null,
      message: msg ?? null,
      stripeRequestId: err?.requestId ?? null,
    }));
    return NextResponse.json(
      { error: "Failed to create checkout session", requestId },
      { status: 500, headers: requestIdHeaders(requestId) }
    );
  }
}
