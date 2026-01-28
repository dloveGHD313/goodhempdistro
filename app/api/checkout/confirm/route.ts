import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getVendorPlanByPriceId } from "@/lib/pricing";
import { getConsumerPlanByPriceId } from "@/lib/consumer-plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConfirmPayload = { sessionId?: string };

const resolveVendorId = async (params: {
  vendorId?: string | null;
  userId?: string | null;
  stripeCustomerId?: string | null;
}) => {
  const admin = getSupabaseAdminClient();
  if (params.vendorId) {
    return params.vendorId;
  }
  if (params.stripeCustomerId) {
    const { data } = await admin
      .from("vendors")
      .select("id")
      .eq("stripe_customer_id", params.stripeCustomerId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  if (params.userId) {
    const { data } = await admin
      .from("vendors")
      .select("id")
      .eq("owner_user_id", params.userId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as ConfirmPayload;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "line_items", "customer"],
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const paymentStatus = session.payment_status;
    if (paymentStatus && paymentStatus !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 409 });
    }

    if (session.mode !== "subscription") {
      return NextResponse.json({ ok: true, mode: session.mode }, { status: 200 });
    }

    const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
    if (!subscriptionId) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionStatus = subscription.status;
    const subscriptionPriceId = subscription.items.data[0]?.price.id || null;
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;

    const userId = session.client_reference_id || session.metadata?.user_id || null;
    const planType = session.metadata?.plan_type || "consumer";
    const vendorId = session.metadata?.vendor_id || null;
    const consumerPlanKey =
      session.metadata?.consumer_plan_key ||
      (subscriptionPriceId ? getConsumerPlanByPriceId(subscriptionPriceId)?.planKey || null : null);
    const vendorPlanKey = subscriptionPriceId
      ? getVendorPlanByPriceId(subscriptionPriceId)?.planKey || null
      : null;

    const admin = getSupabaseAdminClient();

    if (planType === "vendor") {
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
            subscription_price_id: subscriptionPriceId,
            subscription_plan_key: vendorPlanKey,
            subscription_current_period_end: currentPeriodEnd,
            subscription_cancel_at_period_end: cancelAtPeriodEnd,
            subscription_updated_at: new Date().toISOString(),
          })
          .eq("id", resolvedVendorId);
      }
    }

    if (planType === "consumer" && userId) {
      await admin
        .from("consumer_subscriptions")
        .upsert(
          {
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            consumer_plan_key: consumerPlanKey,
            subscription_status: subscriptionStatus,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
    }

    return NextResponse.json(
      { ok: true, mode: session.mode, status: subscriptionStatus },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[checkout/confirm]", message);
    return NextResponse.json({ error: "Failed to confirm checkout" }, { status: 500 });
  }
}
