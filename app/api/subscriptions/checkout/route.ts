import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Create Stripe subscription checkout session
 * Supports both vendor and consumer plan subscriptions
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planType, planName, affiliateCode } = await req.json();

    if (!planType || !planName || !["vendor", "consumer"].includes(planType)) {
      return NextResponse.json(
        { error: "planType (vendor|consumer) and planName are required" },
        { status: 400 }
      );
    }

    let plan: any;
    let tableName: string;

    if (planType === "vendor") {
      tableName = "vendor_plans";
    } else {
      tableName = "consumer_plans";
    }

    const { data: planData, error: planError } = await supabase
      .from(tableName)
      .select("*")
      .eq("name", planName)
      .eq("is_active", true)
      .single();

    if (planError || !planData) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    plan = planData;

    const siteUrl = getSiteUrl();
    const priceId = plan.stripe_price_id; // Optional - if using Stripe Products

    // Create Stripe checkout session for subscription
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      client_reference_id: user.id,
      success_url: `${siteUrl}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/orders/cancel`,
      metadata: {
        plan_type: planType,
        plan_name: planName,
        plan_id: plan.id,
        user_id: user.id,
        affiliate_code: affiliateCode || "",
      },
    };

    // If price_id exists, use it; otherwise use price_data
    if (priceId) {
      sessionConfig.line_items = [
        {
          price: priceId,
          quantity: 1,
        },
      ];
    } else {
      sessionConfig.line_items = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${planType === "vendor" ? "Vendor" : "Consumer"} ${plan.name} Plan`,
              description: `Monthly subscription - ${plan.name} tier`,
            },
            recurring: {
              interval: "month",
            },
            unit_amount: plan.price_cents,
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[subscriptions/checkout]", errorMessage);
    return NextResponse.json(
      { error: "Failed to create subscription checkout" },
      { status: 500 }
    );
  }
}
