import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await getCheckoutSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 404 }
      );
    }

    // Extract order information
    const orderId = session.metadata?.order_id;
    const _userId = session.metadata?.user_id;

    // If we have Supabase configured, update the order
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
          await supabase
            .from("orders")
            .update({
              status: "paid",
              checkout_session_id: sessionId,
              payment_intent_id: session.payment_intent as string,
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);

          console.log("✅ Order updated via confirmation API:", orderId);
        } else {
          console.log("ℹ️ Order already marked as paid:", orderId);
        }
      }
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
  } catch (error: any) {
    console.error("❌ Error confirming order:", error);
    return NextResponse.json(
      { error: error.message || "Failed to confirm order" },
      { status: 500 }
    );
  }
}
