import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase";
import { validateEnvVars } from "@/lib/env-validator";

// Validate required environment variables
if (!validateEnvVars(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], "Stripe Webhook")) {
  throw new Error("Missing required Stripe environment variables");
}

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("❌ No Stripe signature found");
    return NextResponse.json(
      { error: "No signature" },
      { status: 400 }
    );
  }

  if (!webhookSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("❌ Webhook signature verification failed:", errMessage);
    return NextResponse.json(
      { error: `Webhook Error: ${errMessage}` },
      { status: 400 }
    );
  }

  console.log("✅ Webhook verified:", event.type);

  try {
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`📦 Processing checkout.session.completed | order_id=${session.metadata?.order_id || "N/A"} | session=${session.id}`);
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.log(`✅ Processing payment_intent.succeeded | intent=${intent.id} | amount=${intent.amount_received}`);
        await handlePaymentIntentSucceeded(intent);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.log(`❌ Processing payment_intent.payment_failed | intent=${intent.id} | reason=${intent.last_payment_error?.message || "unknown"}`);
        await handlePaymentIntentFailed(intent);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`🔄 Processing ${event.type} | subscription=${sub.id} | status=${sub.status}`);
        await handleSubscriptionChange(event.type, sub);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ Error handling webhook:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  console.log(`💰 [handleCheckoutSessionCompleted] order_id=${orderId} | session=${session.id}`);

  const supabase = await createSupabaseServerClient();

  if (!orderId) {
    console.warn("⚠️ [handleCheckoutSessionCompleted] No order_id in session metadata");
    return;
  }

  // Update order in database
  const { error } = await supabase
    .from("orders")
    .update({
      status: "paid",
      checkout_session_id: session.id,
      payment_intent_id: session.payment_intent as string,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    console.error(`❌ [handleCheckoutSessionCompleted] Failed to update order_id=${orderId}: ${error.message}`);
    throw error;
  }

  console.log(`✅ [handleCheckoutSessionCompleted] Order updated successfully | order_id=${orderId}`);

  // Optional: Send confirmation email, create shipment, etc.
  // await sendOrderConfirmationEmail(session.customer_email, orderId);
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`💳 [handlePaymentIntentSucceeded] intent=${paymentIntent.id} | amount=${paymentIntent.amount_received}`);

  const supabase = await createSupabaseServerClient();

  // Find order by payment_intent_id
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_intent_id", paymentIntent.id)
    .single();

  if (order) {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (error) {
      console.error(`❌ [handlePaymentIntentSucceeded] Failed to update order_id=${order.id}: ${error.message}`);
      throw error;
    }

    console.log(`✅ [handlePaymentIntentSucceeded] Order marked as paid | order_id=${order.id}`);
  } else {
    console.warn(`⚠️ [handlePaymentIntentSucceeded] No order found for intent=${paymentIntent.id}`);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const failureReason = paymentIntent.last_payment_error?.message || "unknown";
  console.log(`❌ [handlePaymentIntentFailed] intent=${paymentIntent.id} | reason=${failureReason}`);

  const supabase = await createSupabaseServerClient();

  // Find order by payment_intent_id
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_intent_id", paymentIntent.id)
    .single();

  if (order) {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "payment_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (error) {
      console.error(`❌ [handlePaymentIntentFailed] Failed to update order_id=${order.id}: ${error.message}`);
      throw error;
    }

    console.log(`⚠️ [handlePaymentIntentFailed] Order marked as payment failed | order_id=${order.id}`);
  } else {
    console.warn(`⚠️ [handlePaymentIntentFailed] No order found for intent=${paymentIntent.id}`);
  }
}

async function handleSubscriptionChange(
  eventType: string,
  subscription: Stripe.Subscription
) {
  const userId = subscription.metadata?.user_id;
  console.log(`🔄 [handleSubscriptionChange] event_type=${eventType} | subscription=${subscription.id} | user_id=${userId || "N/A"} | status=${subscription.status}`);

  const supabase = await createSupabaseServerClient();

  if (!userId) {
    console.warn(`⚠️ [handleSubscriptionChange] No user_id in subscription metadata | subscription=${subscription.id}`);
    return;
  }

  let status: string;
  switch (subscription.status) {
    case "active":
      status = "active";
      break;
    case "canceled":
    case "incomplete_expired":
      status = "canceled";
      break;
    case "past_due":
      status = "past_due";
      break;
    default:
      status = subscription.status;
  }

  // Upsert subscription record
  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        status: status,
        price_id: subscription.items.data[0]?.price.id,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "stripe_subscription_id",
      }
    );

  if (error) {
    console.error(`❌ [handleSubscriptionChange] Failed to upsert subscription: ${error.message}`);
    throw error;
  }

  console.log(`✅ [handleSubscriptionChange] Subscription updated successfully | subscription=${subscription.id} | user_id=${userId}`);
}
