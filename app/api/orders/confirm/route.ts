import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSubscriptionBonusPoints } from "@/lib/consumer-loyalty";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      console.error("❌ [orders/confirm] Missing sessionId");
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    console.log(`📦 [orders/confirm] Processing order confirmation | sessionId=${sessionId}`);

    // Retrieve the checkout session from Stripe
    const session = await getCheckoutSession(sessionId);

    if (!session) {
      console.warn(`⚠️ [orders/confirm] Invalid session | sessionId=${sessionId}`);
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 404 }
      );
    }

    // Extract order information
    const orderId = session.metadata?.order_id;
    const packageType = session.metadata?.package_type; // 'vendor' or 'consumer'
    const packageName = session.metadata?.package_name;
    const userId = session.client_reference_id || session.metadata?.user_id;

    console.log(`📦 [orders/confirm] Session details | orderId=${orderId || "N/A"} | packageType=${packageType || "N/A"} | userId=${userId || "N/A"}`);

    // If we have Supabase configured, update the order using server-only client
    // IMPORTANT: createSupabaseServerClient() uses the service role key only on the server
    // This route runs on the server, so it's safe to use the admin client
    const supabase = await createSupabaseServerClient();

    // Handle package assignment if this is a subscription purchase
    if (packageType && packageName && userId) {
      try {
        if (packageType === "vendor") {
          // Fetch vendor package details
          const { data: pkg } = await supabase
            .from("vendor_packages")
            .select("*")
            .eq("name", packageName)
            .single();

          if (pkg) {
            // Update profile with vendor role and commission
            await supabase
              .from("profiles")
              .upsert({
                id: userId,
                role: "vendor",
                updated_at: new Date().toISOString(),
              }, { onConflict: "id" });

            console.log(`✅ [orders/confirm] Assigned vendor package: ${packageName} to user ${userId}`);
          }
        } else if (packageType === "consumer") {
          // Fetch consumer package details
          const { data: pkg } = await supabase
            .from("consumer_packages")
            .select("*")
            .eq("name", packageName)
            .single();

          if (pkg) {
            const bonusPoints = getSubscriptionBonusPoints();
            if (bonusPoints > 0) {
              await supabase.rpc("consumer_loyalty_add_points", {
                p_user_id: userId,
                p_points: bonusPoints,
                p_event_type: "subscription_bonus",
                p_metadata: { packageName },
              });
            }
            console.log(`✅ [orders/confirm] Assigned consumer package: ${packageName} to user ${userId}`);
          }
        }

        // Check for affiliate referral and reward
        const { data: referral } = await supabase
          .from("affiliate_referrals")
          .select("*, affiliate:affiliates!inner(*)")
          .eq("referred_user_id", userId)
          .eq("status", "pending")
          .single();

        if (referral) {
          // Mark referral as paid
          await supabase
            .from("affiliate_referrals")
            .update({ status: "paid", stripe_session_id: sessionId })
            .eq("id", referral.id);

          console.log(`💰 [orders/confirm] Affiliate reward tracked for referral ${referral.id}`);
        }
      } catch (pkgError) {
        console.error(`⚠️ [orders/confirm] Package assignment error:`, pkgError);
        // Continue with order processing even if package assignment fails
      }
    }
    
    if (orderId) {
      // Check if order exists and update it
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, status")
        .eq("id", orderId)
        .single();

      if (existingOrder) {
        // Only update if not already marked as paid
        if (existingOrder.status !== "paid") {
          const { error } = await supabase
            .from("orders")
            .update({
              status: "paid",
              checkout_session_id: sessionId,
              payment_intent_id: session.payment_intent as string,
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);

          if (error) {
            console.error(`❌ [orders/confirm] Failed to update order | orderId=${orderId} | error=${error.message}`);
            throw error;
          }

          console.log(`✅ [orders/confirm] Order updated via confirmation API | orderId=${orderId}`);
        } else {
          console.log(`ℹ️ [orders/confirm] Order already marked as paid | orderId=${orderId}`);
        }
      } else {
        console.warn(`⚠️ [orders/confirm] Order not found in database | orderId=${orderId}`);
      }
    } else {
      console.warn(`⚠️ [orders/confirm] No orderId in session metadata | sessionId=${sessionId}`);
    }

    // Return order confirmation details
    return NextResponse.json({
      orderId: orderId || "N/A",
      status: "paid",
      sessionId,
      paymentIntentId: session.payment_intent,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [orders/confirm] Error confirming order: ${errorMessage}`);
    return NextResponse.json(
      { error: errorMessage || "Failed to confirm order" },
      { status: 500 }
    );
  }
}
