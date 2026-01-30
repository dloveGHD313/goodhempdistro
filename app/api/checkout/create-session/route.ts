import { NextRequest, NextResponse } from "next/server";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";
import { enforceGatedAccess } from "@/lib/server/marketGate";

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
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const productId = typeof body?.product_id === "string" ? body.product_id : null;
    const rawQuantity = body?.quantity;
    const parsedQuantity = typeof rawQuantity === "number"
      ? Math.floor(rawQuantity)
      : typeof rawQuantity === "string"
        ? Math.floor(Number.parseFloat(rawQuantity))
        : 1;
    const quantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 1;

    if (!productId) {
      return NextResponse.json(
        { error: "product_id is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      return NextResponse.json(
        { error: "Quantity must be between 1 and 50" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Fetch product
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, price_cents, vendor_id, active, status, is_gated, market_category")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!product.active || product.status !== "approved") {
      return NextResponse.json(
        { error: "Product is not available" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (product.is_gated || product.market_category === "INTOXICATING") {
      const gate = await enforceGatedAccess(user.id);
      if (!gate.ok) {
        return NextResponse.json(
          { ok: false, code: gate.code, message: gate.message },
          { status: gate.status, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    if (!product.price_cents || product.price_cents <= 0) {
      return NextResponse.json(
        { error: "Product price is not available" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const totalCents = product.price_cents * quantity;
    const siteUrl = getSiteUrl(req);

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
        { status: 500, headers: { "Cache-Control": "no-store" } }
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
      cancel_url: `${siteUrl}/orders/cancel`,
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
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[checkout/create-session]", errorMessage);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
