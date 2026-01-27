import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getConsumerPlanByKey } from "@/lib/consumer-plans";
import { REFERRAL_SIGNUP_BONUS_POINTS } from "@/lib/consumer-loyalty";

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

    const { planKey, affiliateCode, referralCode } = await req.json();

    if (!planKey || typeof planKey !== "string") {
      return NextResponse.json(
        { error: "planKey is required" },
        { status: 400 }
      );
    }

    const plan = getConsumerPlanByKey(planKey);
    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: existingSubscription } = await admin
      .from("consumer_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let stripeCustomerId = existingSubscription?.stripe_customer_id || null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;
      await admin
        .from("consumer_subscriptions")
        .upsert(
          {
            user_id: user.id,
            stripe_customer_id: stripeCustomerId,
            subscription_status: "incomplete",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
    }

    if (typeof referralCode === "string" && referralCode.trim().length > 0) {
      const { data: referral } = await admin
        .from("consumer_referrals")
        .select("id, referrer_user_id, referred_user_id")
        .eq("referral_code", referralCode.trim())
        .maybeSingle();

      if (referral?.id) {
        if (referral.referrer_user_id === user.id) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[subscriptions/checkout] self-referral blocked", {
              referralCode,
              userId: user.id,
            });
          }
        } else if (!referral.referred_user_id) {
          await admin
            .from("consumer_referrals")
            .update({ referred_user_id: user.id, reward_status: "pending" })
            .eq("id", referral.id);
          await awardReferralSignupBonus({
            admin,
            referralId: referral.id,
            referrerUserId: referral.referrer_user_id,
            referredUserId: user.id,
          });
        }
      }
    }

    const siteUrl = getSiteUrl();
    const priceId = plan.priceId;

    // Create Stripe checkout session for subscription
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      client_reference_id: user.id,
      customer: stripeCustomerId || undefined,
      success_url: `${siteUrl}/account/subscription?success=1`,
      cancel_url: `${siteUrl}/pricing?tab=consumer&canceled=1`,
      metadata: {
        plan_type: "consumer",
        consumer_plan_key: plan.planKey,
        price_id: plan.priceId,
        user_id: user.id,
        affiliate_code: affiliateCode || "",
      },
      subscription_data: {
        metadata: {
          plan_type: "consumer",
          consumer_plan_key: plan.planKey,
          price_id: plan.priceId,
          user_id: user.id,
        },
      },
    };

    // If price_id exists, use it; otherwise use price_data
    sessionConfig.line_items = [
      {
        price: priceId,
        quantity: 1,
      },
    ];

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

async function awardReferralSignupBonus(params: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  referralId: string;
  referrerUserId: string;
  referredUserId: string;
}) {
  if (REFERRAL_SIGNUP_BONUS_POINTS <= 0) {
    return;
  }

  const { data: existing } = await params.admin
    .from("consumer_loyalty_events")
    .select("id")
    .eq("user_id", params.referrerUserId)
    .eq("event_type", "referral_signup_bonus")
    .filter("metadata->>referral_id", "eq", params.referralId)
    .maybeSingle();

  if (existing?.id) {
    return;
  }

  const { error } = await params.admin.rpc("consumer_loyalty_add_points", {
    p_user_id: params.referrerUserId,
    p_points: REFERRAL_SIGNUP_BONUS_POINTS,
    p_event_type: "referral_signup_bonus",
    p_metadata: {
      referral_id: params.referralId,
      referred_user_id: params.referredUserId,
    },
  });

  if (error && process.env.NODE_ENV !== "production") {
    console.warn("[subscriptions/checkout] referral signup bonus failed", error);
  }
}
