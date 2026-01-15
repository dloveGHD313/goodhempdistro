import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";

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

    console.log(`📦 [orders/confirm] Session details | orderId=${orderId || "N/A"} | sessionId=${sessionId}`);

    // If we have Supabase configured, update the order using server-only client
    // IMPORTANT: createSupabaseServerClient() uses the service role key only on the server
    // This route runs on the server, so it's safe to use the admin client
    const supabase = await createSupabaseServerClient();
    
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
