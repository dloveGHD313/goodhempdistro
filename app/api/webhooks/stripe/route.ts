import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase";

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
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  console.log("✅ Webhook verified:", event.type);

  try {
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.type, event.data.object as Stripe.Subscription);
        break;

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
  console.log("💰 Checkout session completed:", session.id);

  const supabase = await createSupabaseServerClient();

  // Extract metadata
  const orderId = session.metadata?.order_id;

  if (!orderId) {
    console.warn("⚠️ No order_id in session metadata");
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
    console.error("❌ Failed to update order:", error);
    throw error;
  }

  console.log("✅ Order updated successfully:", orderId);

  // Optional: Send confirmation email, create shipment, etc.
  // await sendOrderConfirmationEmail(session.customer_email, orderId);
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log("💳 Payment intent succeeded:", paymentIntent.id);

  const supabase = await createSupabaseServerClient();

  // Find order by payment_intent_id
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_intent_id", paymentIntent.id)
    .single();

  if (order) {
    await supabase
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    console.log("✅ Order marked as paid:", order.id);
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log("❌ Payment intent failed:", paymentIntent.id);

  const supabase = await createSupabaseServerClient();

  // Find order by payment_intent_id
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_intent_id", paymentIntent.id)
    .single();

  if (order) {
    await supabase
      .from("orders")
      .update({
        status: "payment_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    console.log("⚠️ Order marked as payment failed:", order.id);
  }
}

async function handleSubscriptionChange(
  eventType: string,
  subscription: Stripe.Subscription
) {
  console.log(`🔄 Subscription ${eventType}:`, subscription.id);

  const supabase = await createSupabaseServerClient();
  const userId = subscription.metadata?.user_id;

  if (!userId) {
    console.warn("⚠️ No user_id in subscription metadata");
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
    console.error("❌ Failed to upsert subscription:", error);
    throw error;
  }

  console.log("✅ Subscription updated successfully");
}
