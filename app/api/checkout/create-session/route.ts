import { NextRequest, NextResponse } from "next/server";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Create Stripe checkout session for product purchase
 * Server-only route - requires authentication
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { product_id, quantity = 1 } = await req.json();

    if (!product_id) {
      return NextResponse.json(
        { error: "product_id is required" },
        { status: 400 }
      );
    }

    // Fetch product
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, price_cents, vendor_id, active")
      .eq("id", product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    if (!product.active) {
      return NextResponse.json(
        { error: "Product is not available" },
        { status: 400 }
      );
    }

    const totalCents = product.price_cents * quantity;
    const siteUrl = getSiteUrl();

    // Create pending order in Supabase
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        vendor_id: product.vendor_id,
        status: "pending",
        total_cents: totalCents,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("Error creating order:", orderError);
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

    // Create order item
    const { error: itemError } = await supabase
      .from("order_items")
      .insert({
        order_id: order.id,
        product_id: product.id,
        quantity: quantity,
        unit_price_cents: product.price_cents,
      });

    if (itemError) {
      console.error("Error creating order item:", itemError);
      // Continue anyway - order is created
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
            },
            unit_amount: product.price_cents,
          },
          quantity: quantity,
        },
      ],
      success_url: `${siteUrl}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/products`,
      client_reference_id: user.id,
      metadata: {
        order_id: order.id,
        product_id: product.id,
        vendor_id: product.vendor_id || "",
      },
    });

    // Update order with session ID
    await supabase
      .from("orders")
      .update({ checkout_session_id: session.id })
      .eq("id", order.id);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[checkout/create-session]", errorMessage);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
