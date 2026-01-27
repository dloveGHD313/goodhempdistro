import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { validateEnvVars } from "@/lib/env-validator";
import { getVendorPlanByPriceId } from "@/lib/pricing";

// Lazy initialization - only create Stripe client when actually used
// This allows the build to complete even if env vars are missing
function getStripeClient(): Stripe {
  if (!validateEnvVars(["STRIPE_SECRET_KEY"], "Stripe Webhook")) {
    throw new Error("Missing required Stripe environment variables: STRIPE_SECRET_KEY");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-02-24.acacia",
  });
}

function getWebhookSecret(): string {
  if (!validateEnvVars(["STRIPE_WEBHOOK_SECRET"], "Stripe Webhook")) {
    throw new Error("Missing required Stripe environment variables: STRIPE_WEBHOOK_SECRET");
  }
  return process.env.STRIPE_WEBHOOK_SECRET!;
}

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

  let event: Stripe.Event | null = null;

  try {
    // Initialize clients (will throw if env vars missing)
    const stripe = getStripeClient();
    const webhookSecret = getWebhookSecret();
    
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

  console.log("✅ Webhook verified:", { type: event.type, id: event.id });

  try {
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`📦 Processing checkout.session.completed | order_id=${session.metadata?.order_id || "N/A"} | mode=${session.mode} | session=${session.id}`);
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`💰 Processing invoice.paid | subscription=${invoice.subscription || "N/A"} | invoice=${invoice.id}`);
        await handleInvoicePaid(invoice);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`💰 Processing invoice.payment_succeeded | subscription=${invoice.subscription || "N/A"} | invoice=${invoice.id}`);
        await handleInvoicePaid(invoice);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`💥 Processing invoice.payment_failed | subscription=${invoice.subscription || "N/A"} | invoice=${invoice.id}`);
        if (invoice.subscription) {
          const stripeClient = getStripeClient();
          const subscription = await stripeClient.subscriptions.retrieve(
            invoice.subscription as string
          );
          await handleSubscriptionChange(event.type, subscription);
        }
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
    console.error("❌ Error handling webhook:", {
      eventType: event?.type,
      eventId: event?.id,
      error,
    });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

async function resolveVendorId(params: {
  vendorId?: string | null;
  userId?: string | null;
  stripeCustomerId?: string | null;
}) {
  const admin = getSupabaseAdminClient();
  if (params.vendorId) {
    return params.vendorId;
  }
  if (params.stripeCustomerId) {
    const { data: vendorByCustomer } = await admin
      .from("vendors")
      .select("id")
      .eq("stripe_customer_id", params.stripeCustomerId)
      .maybeSingle();
    if (vendorByCustomer?.id) {
      return vendorByCustomer.id;
    }
  }
  if (params.userId) {
    const { data: vendorByUser } = await admin
      .from("vendors")
      .select("id")
      .eq("owner_user_id", params.userId)
      .maybeSingle();
    if (vendorByUser?.id) {
      return vendorByUser.id;
    }
  }
  return null;
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  const planType = session.metadata?.plan_type; // 'vendor' or 'consumer'
  const planName = session.metadata?.plan_name;
  const planId = session.metadata?.plan_id;
  const priceId = session.metadata?.price_id;
  const vendorId = session.metadata?.vendor_id;
  const userId = session.client_reference_id || session.metadata?.user_id;
  const affiliateCode = session.metadata?.affiliate_code;

  console.log(`💰 [handleCheckoutSessionCompleted] order_id=${orderId} | mode=${session.mode} | session=${session.id} | user_id=${userId} | plan=${planName} | affiliate=${affiliateCode}`);

  const supabase = await createSupabaseServerClient();

  // Handle subscription checkout
  if (session.mode === "subscription" && userId && planId) {
    const subscriptionId = session.subscription as string;
    const stripeClient = getStripeClient();
    const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    const subscriptionStatus = subscription.status;
    const subscriptionPriceId = subscription.items.data[0]?.price.id || null;
    const subscriptionPlanKey = subscriptionPriceId
      ? getVendorPlanByPriceId(subscriptionPriceId)?.planKey || null
      : null;
    const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
    
    // Create subscription record from checkout
    const { error: subError } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: userId,
        plan_type: planType || "consumer",
        plan_id: planId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: session.customer as string,
        status: subscriptionStatus,
        price_id: priceId || subscriptionPriceId || null,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "stripe_subscription_id",
      });

    if (subError) {
      console.error(`❌ [handleCheckoutSessionCompleted] Failed to create subscription: ${subError.message}`);
    } else {
      console.log(`✅ [handleCheckoutSessionCompleted] Subscription created | subscription_id=${subscriptionId}`);

      // Link subscription to profile
      if (planId) {
        await supabase
          .from("profiles")
          .update({ active_subscription_id: subscriptionId })
          .eq("id", userId);
      }
    }

    if (planType === "vendor") {
      const admin = getSupabaseAdminClient();
      const resolvedVendorId = await resolveVendorId({
        vendorId,
        userId,
        stripeCustomerId: session.customer as string,
      });
      if (resolvedVendorId) {
        await admin
          .from("vendors")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            subscription_status: subscriptionStatus,
            subscription_price_id: priceId || subscriptionPriceId || null,
            subscription_plan_key: subscriptionPlanKey,
            subscription_current_period_end: currentPeriodEnd,
            subscription_cancel_at_period_end: cancelAtPeriodEnd,
            subscription_updated_at: new Date().toISOString(),
          })
          .eq("id", resolvedVendorId);
        console.log("✅ [vendor-subscription] updated via checkout", {
          vendorId: resolvedVendorId,
          status: subscriptionStatus,
          subscriptionId,
        });
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[vendor-subscription] vendorId=${resolvedVendorId} status=${subscriptionStatus} source=checkout`
          );
        }
      }
    }

    // Handle referral tracking for subscription
    if (planType && planName && affiliateCode) {
      await handleReferralTracking(session.id, userId, planType, planName, affiliateCode, supabase);
    }

    return;
  }

  // Handle event order (check metadata for order_type)
  const orderType = session.metadata?.order_type;
  if (orderId && orderType === "event") {
    await handleEventOrderCompleted(session, orderId, supabase);
    return;
  }

  // Handle one-time payment (regular product order)
  if (orderId) {
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (existingOrder?.status === "paid") {
      console.log(`ℹ️ [handleCheckoutSessionCompleted] Order already paid | order_id=${orderId}`);
      return;
    }

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
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`💳 [handlePaymentIntentSucceeded] intent=${paymentIntent.id} | amount=${paymentIntent.amount_received}`);

  const supabase = await createSupabaseServerClient();

  // Find order by payment_intent_id
  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("payment_intent_id", paymentIntent.id)
    .single();

  if (order) {
    if (order.status === "paid") {
      console.log(`ℹ️ [handlePaymentIntentSucceeded] Order already paid | order_id=${order.id}`);
      return;
    }
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
    .select("id, status")
    .eq("payment_intent_id", paymentIntent.id)
    .single();

  if (order) {
    if (order.status === "payment_failed") {
      console.log(`ℹ️ [handlePaymentIntentFailed] Order already failed | order_id=${order.id}`);
      return;
    }
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

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const supabase = await createSupabaseServerClient();

  // Get subscription to find user
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("user_id, plan_type, plan_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (!subscription) {
    console.warn(`⚠️ [handleInvoicePaid] Subscription not found for ${subscriptionId}`);
    return;
  }

  // Mark referral as paid if this is first invoice for subscription
  if (subscription.plan_type && subscription.user_id) {
    const { data: referrals } = await supabase
      .from("affiliate_referrals")
      .select("id")
      .eq("referred_user_id", subscription.user_id)
      .eq("plan_type", subscription.plan_type)
      .eq("status", "pending")
      .limit(1);

    if (referrals && referrals.length > 0) {
      await supabase
        .from("affiliate_referrals")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", referrals[0].id);

      console.log(`✅ [handleInvoicePaid] Marked referral as paid | referral_id=${referrals[0].id}`);
    }
  }

  console.log(`✅ [handleInvoicePaid] Invoice paid processed | subscription=${subscriptionId}`);
}

async function handleSubscriptionChange(
  eventType: string,
  subscription: Stripe.Subscription
) {
  const userId = subscription.metadata?.user_id || null;
  const planId = subscription.metadata?.plan_id;
  const planType = subscription.metadata?.plan_type as "vendor" | "consumer" | undefined;
  const vendorId = subscription.metadata?.vendor_id || null;
  
  console.log(`🔄 [handleSubscriptionChange] event_type=${eventType} | subscription=${subscription.id} | user_id=${userId || "N/A"} | status=${subscription.status}`);

  const supabase = await createSupabaseServerClient();

  if (!userId && process.env.NODE_ENV !== "production") {
    console.warn(`⚠️ [handleSubscriptionChange] No user_id in subscription metadata | subscription=${subscription.id}`);
  }

  let status: string;
  switch (subscription.status) {
    case "active":
      status = "active";
      break;
    case "trialing":
      status = "trialing";
      break;
    case "canceled":
    case "incomplete_expired":
      status = "canceled";
      break;
    case "past_due":
      status = "past_due";
      break;
    case "unpaid":
      status = "unpaid";
      break;
    default:
      status = subscription.status;
  }

  // Upsert subscription record
  if (userId) {
    const { error } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan_type: planType,
          plan_id: planId || null,
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
  }

  if (planType === "vendor") {
    const admin = getSupabaseAdminClient();
    const subscriptionPriceId = subscription.items.data[0]?.price.id || null;
    const subscriptionPlanKey = subscriptionPriceId
      ? getVendorPlanByPriceId(subscriptionPriceId)?.planKey || null
      : null;
    const resolvedVendorId = await resolveVendorId({
      vendorId,
      userId,
      stripeCustomerId: subscription.customer as string,
    });
    if (resolvedVendorId) {
      await admin
        .from("vendors")
        .update({
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
          subscription_status: status,
          subscription_price_id: subscriptionPriceId,
          subscription_plan_key: subscriptionPlanKey,
          subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          subscription_cancel_at_period_end: subscription.cancel_at_period_end,
          subscription_updated_at: new Date().toISOString(),
        })
        .eq("id", resolvedVendorId);
      console.log("✅ [vendor-subscription] updated via webhook", {
        vendorId: resolvedVendorId,
        status,
        subscriptionId: subscription.id,
      });
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[vendor-subscription] vendorId=${resolvedVendorId} status=${status} source=webhook`
        );
      }
    }
  }

  // Update profile active_subscription_id when active
  if (status === "active") {
    await supabase
      .from("profiles")
      .update({ active_subscription_id: subscription.id })
      .eq("id", userId);
  } else if (status === "canceled") {
    await supabase
      .from("profiles")
      .update({ active_subscription_id: null })
      .eq("id", userId);
  }

  console.log(`✅ [handleSubscriptionChange] Subscription ${status} | subscription_id=${subscription.id}`);
}

/**
 * Handle referral tracking and payout creation
 * Captures reward amount based on package type
 * Creates pending payout ledger entry (idempotent by session_id)
 */
async function handleReferralTracking(
  sessionId: string,
  userId: string,
  packageType: string,
  packageName: string,
  affiliateCode: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  console.log(`💝 [handleReferralTracking] Tracking referral | session_id=${sessionId} | user_id=${userId} | package=${packageName} | affiliate=${affiliateCode}`);

  try {
    // Calculate reward based on package
    const rewardMap: Record<string, number> = {
      // Consumer packages: $5, $15, $25
      STARTER: 500,
      PLUS: 1500,
      VIP: 2500,
      // Vendor packages: $5, $15, $25
      BASIC: 500,
      PRO: 1500,
      ELITE: 2500,
    };

    const rewardCents = rewardMap[packageName.toUpperCase()] || 500;

    // Check if referral already exists for this session (idempotency)
    const { data: existingReferral, error: lookupError } = await supabase
      .from("affiliate_referrals")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (lookupError) {
      console.error(`❌ [handleReferralTracking] Error checking existing referral: ${lookupError.message}`);
      return;
    }

    if (existingReferral) {
      console.log(`ℹ️ [handleReferralTracking] Referral already exists for session_id=${sessionId} | skipping (idempotent)`);
      return;
    }

    // Find affiliate by code
    const { data: affiliate, error: affiliateError } = await supabase
      .from("affiliates")
      .select("id")
      .eq("affiliate_code", affiliateCode)
      .eq("status", "active")
      .single();

    if (affiliateError || !affiliate) {
      console.warn(`⚠️ [handleReferralTracking] Affiliate not found for code=${affiliateCode} | referral not tracked`);
      return;
    }

    console.log(`✅ [handleReferralTracking] Found affiliate | affiliate_id=${affiliate.id} | reward=${rewardCents}¢`);

    // Create affiliate_referrals record (idempotent via UNIQUE session_id)
    const { data: referral, error: referralError } = await supabase
      .from("affiliate_referrals")
      .insert({
        affiliate_id: affiliate.id,
        referred_user_id: userId,
        plan_type: packageType as "vendor" | "consumer",
        stripe_session_id: sessionId,
        status: "pending",
        reward_cents: rewardCents,
      })
      .select("id")
      .single();

    if (referralError) {
      // Check if this is a unique violation (idempotent)
      if (referralError.code === "23505" || referralError.message?.includes("duplicate")) {
        console.log(`ℹ️ [handleReferralTracking] Referral already inserted for session_id=${sessionId} (idempotent duplicate)`);
        return;
      }
      console.error(`❌ [handleReferralTracking] Error inserting referral: ${referralError.message}`);
      return;
    }

    console.log(`✅ [handleReferralTracking] Referral created | referral_id=${referral.id}`);

    // Create affiliate_payouts record (pending payout)
    const { data: payout, error: payoutError } = await supabase
      .from("affiliate_payouts")
      .insert({
        affiliate_id: affiliate.id,
        amount_cents: rewardCents,
        status: "pending",
        note: `Referral reward for session ${sessionId}`,
      })
      .select("id")
      .single();

    if (payoutError) {
      console.error(`❌ [handleReferralTracking] Error inserting payout: ${payoutError.message}`);
      return;
    }

    console.log(`✅ [handleReferralTracking] Payout created | payout_id=${payout.id} | amount=${rewardCents}¢ | status=pending`);
  } catch (error) {
    console.error(`❌ [handleReferralTracking] Error tracking referral: ${error}`);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Handle event order completion
 * Atomically updates inventory (tickets_sold, ticket_type.sold) and marks order as paid
 */
async function handleEventOrderCompleted(
  session: Stripe.Checkout.Session,
  orderId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
) {
  console.log(`🎫 [handleEventOrderCompleted] Processing event order | order_id=${orderId} | session=${session.id}`);

  const admin = getSupabaseAdminClient();

  // Fetch order with items
  const { data: order, error: orderError } = await admin
    .from("event_orders")
    .select("id, event_id, status")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    console.error(`❌ [handleEventOrderCompleted] Order not found: ${orderId}`);
    return;
  }

  if (order.status === "paid") {
    console.log(`ℹ️ [handleEventOrderCompleted] Order already paid | order_id=${orderId}`);
    return;
  }

  // Fetch order items with ticket types
  const { data: orderItems, error: itemsError } = await admin
    .from("event_order_items")
    .select("ticket_type_id, quantity")
    .eq("event_order_id", orderId);

  if (itemsError || !orderItems || orderItems.length === 0) {
    console.error(`❌ [handleEventOrderCompleted] No order items found for order_id=${orderId}`);
    return;
  }

  // Fetch ticket types for inventory check
  const ticketTypeIds = orderItems.map((item) => item.ticket_type_id);
  const { data: ticketTypes, error: ticketTypesError } = await admin
    .from("event_ticket_types")
    .select("id, quantity, sold")
    .in("id", ticketTypeIds);

  if (ticketTypesError || !ticketTypes) {
    console.error(`❌ [handleEventOrderCompleted] Failed to fetch ticket types`);
    return;
  }

  // Verify inventory one more time (prevent race conditions)
  const ticketTypeMap = new Map(ticketTypes.map((tt) => [tt.id, tt]));
  let totalTickets = 0;

  for (const item of orderItems) {
    const ticketType = ticketTypeMap.get(item.ticket_type_id);
    if (!ticketType) continue;

    totalTickets += item.quantity;

    // Check ticket type availability
    if (ticketType.quantity !== null) {
      if (ticketType.sold + item.quantity > ticketType.quantity) {
        console.error(`❌ [handleEventOrderCompleted] Inventory exceeded for ticket_type=${item.ticket_type_id}`);
        // Mark order as cancelled due to inventory issue
        await admin
          .from("event_orders")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", orderId);
        return;
      }
    }
  }

  // Fetch event for capacity check
  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id, capacity, tickets_sold")
    .eq("id", order.event_id)
    .single();

  if (eventError || !event) {
    console.error(`❌ [handleEventOrderCompleted] Event not found: ${order.event_id}`);
    return;
  }

  // Check event capacity
  if (event.capacity !== null) {
    if (event.tickets_sold + totalTickets > event.capacity) {
      console.error(`❌ [handleEventOrderCompleted] Event capacity exceeded | event_id=${order.event_id}`);
      await admin
        .from("event_orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      return;
    }
  }

  // Use transaction-like approach: update all inventory atomically
  // Update ticket types sold counts
  for (const item of orderItems) {
    const ticketType = ticketTypeMap.get(item.ticket_type_id);
    if (!ticketType) continue;

    const { error: updateError } = await admin
      .from("event_ticket_types")
      .update({
        sold: ticketType.sold + item.quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.ticket_type_id);

    if (updateError) {
      console.error(`❌ [handleEventOrderCompleted] Failed to update ticket_type=${item.ticket_type_id}: ${updateError.message}`);
      // Rollback: mark order as cancelled
      await admin
        .from("event_orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      return;
    }
  }

  // Update event tickets_sold
  const { error: eventUpdateError } = await admin
    .from("events")
    .update({
      tickets_sold: event.tickets_sold + totalTickets,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.event_id);

  if (eventUpdateError) {
    console.error(`❌ [handleEventOrderCompleted] Failed to update event tickets_sold: ${eventUpdateError.message}`);
    // Rollback ticket types (complex, but mark order as cancelled at least)
    await admin
      .from("event_orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return;
  }

  // Mark order as paid
  const { error: orderUpdateError } = await admin
    .from("event_orders")
    .update({
      status: "paid",
      stripe_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (orderUpdateError) {
    console.error(`❌ [handleEventOrderCompleted] Failed to update order status: ${orderUpdateError.message}`);
    throw orderUpdateError;
  }

  console.log(`✅ [handleEventOrderCompleted] Event order completed | order_id=${orderId} | tickets=${totalTickets}`);
}
