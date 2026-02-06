import { NextRequest, NextResponse } from "next/server";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";
import { isGatedProduct, requireMarketAccess } from "@/lib/server/marketGate";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";
import {
  isDeliveryAllowedForCategory,
  isSaleAllowedForCategory,
  type HempStateRule,
} from "@/lib/server/hempStateRules";

/**
 * Create Stripe checkout session for product purchase
 * Server-only route - requires authentication
 */
export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const noStoreHeaders = { "Cache-Control": "no-store", "X-Request-Id": requestId };
  const error = (
    status: number,
    code: string,
    message: string,
    extra?: Record<string, unknown>
  ) =>
    NextResponse.json(
      { code, message, ref: requestId, ...(extra || {}) },
      { status, headers: noStoreHeaders }
    );

  try {
    assertStripeLiveConfig();
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return error(401, "UNAUTHORIZED", "Unauthorized");
    }

    const body = await req.json().catch(() => ({}));
    const productId = typeof body?.product_id === "string" ? body.product_id : null;
    const rawQuantity = body?.quantity;
    const deliverySelected = body?.delivery_selected === true;
    const customerStateRaw = typeof body?.customer_state === "string" ? body.customer_state.trim().toUpperCase().slice(0, 2) : null;
    const deliveryDistanceMilesRaw = parseFiniteNumber(body?.delivery_distance_miles);
    const deliveryDistanceMiles =
      deliveryDistanceMilesRaw != null && deliveryDistanceMilesRaw >= 0
        ? deliveryDistanceMilesRaw
        : null;
    const vendorLat = parseFiniteNumber(body?.vendor_lat);
    const vendorLng = parseFiniteNumber(body?.vendor_lng);
    const customerLat = parseFiniteNumber(body?.customer_lat);
    const customerLng = parseFiniteNumber(body?.customer_lng);
    const parsedQuantity = typeof rawQuantity === "number"
      ? Math.floor(rawQuantity)
      : typeof rawQuantity === "string"
        ? Math.floor(Number.parseFloat(rawQuantity))
        : 1;
    const quantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 1;

    const fulfillmentMethod: "pickup" | "delivery" | "shipping" =
      body?.fulfillment_method === "delivery" ||
      body?.fulfillment_method === "shipping" ||
      body?.fulfillment_method === "pickup"
        ? body.fulfillment_method
        : "pickup";

    const customerState = typeof body?.customer_state === "string"
      ? body.customer_state.trim().toUpperCase()
      : "";

    if (!productId) {
      return error(400, "INVALID_REQUEST", "product_id is required");
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      return error(400, "INVALID_QUANTITY", "Quantity must be between 1 and 50");
    }

    // Fetch product and vendor (status) for order_items — suspended vendors cannot accept orders (4.3.B)
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, price_cents, vendor_id, active, status, is_gated, market_category, product_type, vendors(owner_user_id)")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return error(404, "PRODUCT_NOT_FOUND", "Product not found");
    }

    if (!product.active || product.status !== "approved") {
      return error(400, "PRODUCT_UNAVAILABLE", "Product is not available");
    }

    const vendorRow = Array.isArray(product.vendors)
      ? (product.vendors as { owner_user_id: string; status?: string }[])[0]
      : (product.vendors as { owner_user_id: string; status?: string } | undefined);
    if (vendorRow?.status !== "active") {
      return NextResponse.json(
        { error: "Product is not available" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const marketMode: "gated" | "ungated" =
      product.is_gated ||
      product.market_category === "RECREATIONAL" ||
      product.market_category === "INTOXICATING"
        ? "gated"
        : "ungated";
    const gatedProduct = { ...product, market_mode: marketMode };

    if (isGatedProduct(gatedProduct)) {
      const gate = await requireMarketAccess(user.id, "gated");
      if (!gate.ok) {
        return NextResponse.json(
          {
            code: gate.code,
            message: gate.message,
            ref: requestId,
            redirectTo: gate.redirectTo || "/verify",
          },
          { status: gate.status, headers: noStoreHeaders }
        );
      }
    }

    if (!product.price_cents || product.price_cents <= 0) {
      return error(400, "PRICE_UNAVAILABLE", "Product price is not available");
    }

    const productType = typeof product.product_type === "string" ? product.product_type : "";
    const isIntoxicating =
      productType === "intoxicating" ||
      product.market_category === "INTOXICATING" ||
      product.market_category === "RECREATIONAL";

    if (fulfillmentMethod === "delivery" && !/^[A-Z]{2}$/.test(customerState)) {
      return error(400, "STATE_REQUIRED", "customer_state is required for delivery");
    }

    let stateRule: HempStateRule | null = null;
    if (/^[A-Z]{2}$/.test(customerState)) {
      const { data: rule } = await supabase
        .from("hemp_state_rules")
        .select("state_code, sale_allowed, intoxicating_sale_allowed, non_intoxicating_sale_allowed, delivery_allowed, intoxicating_delivery_allowed, non_intoxicating_delivery_allowed")
        .eq("state_code", customerState)
        .maybeSingle();
      stateRule = (rule as HempStateRule | null) ?? null;
    }

    if (fulfillmentMethod === "delivery") {
      const saleAllowed = isSaleAllowedForCategory(stateRule, isIntoxicating);
      const deliveryAllowed = isDeliveryAllowedForCategory(stateRule, isIntoxicating);
      if (!saleAllowed || !deliveryAllowed) {
        return error(
          400,
          "STATE_COMPLIANCE_BLOCK",
          "Delivery is not allowed for this product in the selected state",
          { available_fulfillment: ["pickup", "shipping"] }
        );
      }
    } else if (stateRule) {
      const saleAllowed = isSaleAllowedForCategory(stateRule, isIntoxicating);
      if (!saleAllowed) {
        return error(400, "STATE_SALE_BLOCK", "Sale is not allowed for this product in the selected state");
      }
    }

    let totalCents = product.price_cents * quantity;
    const lineTotalCents = product.price_cents * quantity;
    const siteUrl = getSiteUrl(req);
    const vendorOwnerId = Array.isArray(product.vendors)
      ? (product.vendors as { owner_user_id: string }[])[0]?.owner_user_id
      : (product.vendors as { owner_user_id: string } | undefined)?.owner_user_id ?? null;

    let deliveryFees: Awaited<ReturnType<typeof computeDeliveryFees>> = null;
    if (deliverySelected) {
      if (!customerStateRaw || customerStateRaw.length !== 2) {
        return NextResponse.json(
          { error: "Delivery requires a valid delivery state (2-letter state code)" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      const deliveryAllowed = await isDeliveryAllowedInState(customerStateRaw);
      if (!deliveryAllowed) {
        return NextResponse.json(
          { error: "Delivery is not available in your state due to local regulations." },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      let distanceMiles: number | null = deliveryDistanceMiles;
      if (distanceMiles == null) {
        const allCoordsPresent =
          vendorLat != null &&
          vendorLng != null &&
          customerLat != null &&
          customerLng != null;
        const vendorValid =
          vendorLat != null &&
          vendorLng != null &&
          validateLatLng(vendorLat, vendorLng);
        const customerValid =
          customerLat != null &&
          customerLng != null &&
          validateLatLng(customerLat, customerLng);
        if (allCoordsPresent && vendorValid && customerValid) {
          const computed = haversineMiles(
            vendorLat!,
            vendorLng!,
            customerLat!,
            customerLng!
          );
          if (Number.isFinite(computed) && computed >= 0) {
            distanceMiles = computed;
          }
        }
      }
      if (
        distanceMiles == null ||
        !Number.isFinite(distanceMiles) ||
        distanceMiles < 0
      ) {
        return NextResponse.json(
          { error: "Distance unavailable for delivery" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      deliveryFees = await computeDeliveryFees(distanceMiles);
      if (!deliveryFees) {
        return NextResponse.json(
          { error: "Delivery pricing not available" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      if (
        !Number.isFinite(deliveryFees.deliveryFeeCustomer) ||
        deliveryFees.deliveryFeeCustomer < 0
      ) {
        return NextResponse.json(
          { error: "Delivery fee unavailable" },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
      totalCents += Math.round(deliveryFees.deliveryFeeCustomer * 100);
    }

    const orderPayload: Record<string, unknown> = {
      user_id: user.id,
      vendor_id: product.vendor_id,
      status: "pending",
      total_cents: totalCents,
      currency: "usd",
      delivery_selected: deliverySelected,
      delivery_status: deliverySelected ? "unassigned" : null,
    };
    if (deliveryFees) {
      orderPayload.delivery_distance_miles = deliveryFees.distanceMiles;
      orderPayload.delivery_fee_customer = deliveryFees.deliveryFeeCustomer;
      orderPayload.delivery_fee_driver_estimate = deliveryFees.deliveryFeeDriverEstimate;
      orderPayload.delivery_margin = deliveryFees.deliveryMargin;
      orderPayload.delivery_pricing_version = deliveryFees.pricingVersion;
    }

    // Create pending order in Supabase
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (orderError || !order) {
      return error(500, "ORDER_CREATE_FAILED", "Failed to create order");
    }

    // Create order item (item_type, item_id, vendor_user_id, line_total_cents)
    const { error: itemError } = await supabase
      .from("order_items")
      .insert({
        order_id: order.id,
        product_id: product.id,
        item_type: "product",
        item_id: product.id,
        vendor_user_id: vendorOwnerId,
        quantity,
        unit_price_cents: product.price_cents,
        line_total_cents: lineTotalCents,
      });

    if (itemError) {
      return error(500, "ORDER_ITEM_CREATE_FAILED", "Failed to create order item");
    }

    const lineItems: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }[] = [
      {
        price_data: {
          currency: "usd",
          product_data: { name: product.name },
          unit_amount: product.price_cents,
        },
        quantity,
      },
    ];
    if (
      deliveryFees &&
      Number.isFinite(deliveryFees.deliveryFeeCustomer) &&
      deliveryFees.deliveryFeeCustomer > 0
    ) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Delivery fee" },
          unit_amount: Math.round(deliveryFees.deliveryFeeCustomer * 100),
        },
        quantity: 1,
      });
    }

    // Create Stripe checkout session
    const stripeSession = await stripe.checkout.sessions.create({
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
          quantity,
        },
      ],
      success_url: `${siteUrl}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/orders/cancel`,
      client_reference_id: user.id,
      metadata: {
        order_id: order.id,
        product_id: product.id,
        vendor_id: product.vendor_id || "",
        fulfillment_method: fulfillmentMethod,
      },
    });

    // Update order with session ID
    await supabase
      .from("orders")
      .update({ checkout_session_id: stripeSession.id })
      .eq("id", order.id);

    return NextResponse.json(
      { sessionId: stripeSession.id, url: stripeSession.url },
      { headers: noStoreHeaders }
    );
  } catch (errorValue: unknown) {
    const errorMessage = errorValue instanceof Error ? errorValue.message : String(errorValue);
    console.error("[checkout/create-session]", { requestId, message: errorMessage.slice(0, 300) });
    return error(500, "CHECKOUT_SESSION_CREATE_FAILED", "Failed to create checkout session");
  }
}
