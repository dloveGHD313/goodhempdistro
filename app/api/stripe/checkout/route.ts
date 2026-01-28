import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { validateEnvVars } from "@/lib/env-validator";

type CheckoutPayload = {
  priceId?: string;
  planKey?: string;
  tier?: string;
  cadence?: string;
  productLimit?: number | null;
  commission?: number | null;
};

export async function POST(req: NextRequest) {
  try {
    if (!validateEnvVars(["STRIPE_SECRET_KEY"], "stripe/checkout")) {
      return NextResponse.json(
        { error: "Stripe configuration is missing" },
        { status: 500 }
      );
    }
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as CheckoutPayload;
    const priceId = typeof body.priceId === "string" ? body.priceId : null;
    if (!priceId) {
      return NextResponse.json({ error: "priceId is required" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: vendor } = await admin
      .from("vendors")
      .select("id, owner_user_id, business_name, stripe_customer_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!vendor) {
      return NextResponse.json({ error: "Vendor account required" }, { status: 404 });
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
      cancel_url: `${siteUrl}/pricing?canceled=1`,
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

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[stripe/checkout]", message);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
