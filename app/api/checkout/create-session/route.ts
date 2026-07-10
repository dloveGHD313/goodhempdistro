import { NextRequest, NextResponse } from "next/server";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isGatedProduct, requireMarketAccess } from "@/lib/server/marketGate";
import { assertStripeLiveConfig } from "@/lib/env/stripeEnv";
import {
  computeDeliveryFees,
  haversineMiles,
} from "@/lib/server/deliveryPricing";
import {
  getHempStateRule,
  isDeliveryAllowedForCategory,
  isSaleAllowedForCategory,
} from "@/lib/server/hempStateRules";
import { getPlatformFeeForCheckout } from "@/lib/billing/connectFees";
import { resolveConsumerTier } from "@/lib/entitlements";
import {
  computeDiscountCents,
  fetchUserCouponsByCodes,
  selectApplicableCoupons,
} from "@/lib/coupons";

type FulfillmentMethod = "pickup" | "delivery" | "shipping";

/** Returns number only if value is finite (rejects NaN/Infinity). */
function parseFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
}

/** Validates lat in [-90, 90] and lng in [-180, 180]; rejects NaN/Infinity. */
function validateLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Create Stripe checkout session for product purchase
 * Server-only route - requires authentication
 */
export async function POST(req: NextRequest) {
  try {
    assertStripeLiveConfig();
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const productId = typeof body?.product_id === "string" ? body.product_id : null;
    const rawQuantity = body?.quantity;
    const deliverySelected = body?.delivery_selected === true;
    const customerStateRaw = typeof body?.customer_state === "string" ? body.customer_state.trim().toUpperCase().slice(0, 2) : null;
    const customerState = customerStateRaw && customerStateRaw.length === 2 ? customerStateRaw : null;
    const rawFulfillment = typeof body?.fulfillment_method === "string" ? body.fulfillment_method.trim().toLowerCase() : null;
    const fulfillmentMethod: FulfillmentMethod =
      rawFulfillment === "delivery" || rawFulfillment === "pickup" || rawFulfillment === "shipping"
        ? rawFulfillment
        : deliverySelected
          ? "delivery"
          : "pickup";
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

    // Fetch product and vendor (status) for order_items — suspended vendors cannot accept orders (4.3.B)
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, price_cents, vendor_id, active, status, is_gated, market_category, product_type, is_intoxicating, is_delta8, vendors(owner_user_id, status)")
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

    // Delta-8 not allowed on platform (runtime block even if active somehow)
    const isDelta8 = product.is_delta8 === true || product.product_type === "delta8";
    if (isDelta8) {
      return NextResponse.json(
        { code: "DELTA8_BLOCKED", message: "This product category is not available for purchase" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const isIntoxicating = product.is_intoxicating === true || product.product_type === "intoxicating";

    // State rules: single source of truth is fulfillmentMethod (not delivery_selected) to prevent bypass.
    // Delivery implies sale — enforce both delivery and sale checks for delivery orders.
    if (fulfillmentMethod === "delivery") {
      if (!customerState) {
        return NextResponse.json(
          {
            code: "STATE_REQUIRED",
            message: "Delivery requires your state. Please provide customer_state (2-letter code).",
            available_fulfillment: ["pickup", "shipping"],
          },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      const stateRule = await getHempStateRule(customerState);
      const deliveryAllowed = isDeliveryAllowedForCategory(stateRule, isIntoxicating);
      const saleAllowed = isSaleAllowedForCategory(stateRule, isIntoxicating);
      if (!deliveryAllowed || !saleAllowed) {
        return NextResponse.json(
          {
            code: "STATE_COMPLIANCE_BLOCK",
            message: "Delivery is not available in your state due to local regulations. Choose pickup or shipping.",
            available_fulfillment: ["pickup", "shipping"],
          },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
    } else if (customerState) {
      const stateRule = await getHempStateRule(customerState);
      if (!isSaleAllowedForCategory(stateRule, isIntoxicating)) {
        return NextResponse.json(
          {
            code: "STATE_SALE_BLOCK",
            message: "This product cannot be sold in your state. Please remove it from your order.",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
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
            ok: false,
            code: gate.code,
            message: gate.message,
            redirectTo: gate.redirectTo || "/verify",
          },
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

    let totalCents = product.price_cents * quantity;
    const lineTotalCents = product.price_cents * quantity;

    // Member coupons (perks spec 2026-07-10 §4, CEO stacking decision):
    // validate server-side against the user's OWN coupons; at most one
    // platform + one vendor coupon (stacking Plus/Premium only, otherwise
    // best single coupon); total discount clamped to the 25% order cap —
    // never reject. Discount applies to the product subtotal only, never
    // delivery fees. Coupons are marked redeemed by the paid webhook, not
    // here, so abandoned checkouts don't burn them.
    const rawCouponCodes: string[] = Array.isArray(body?.coupon_codes)
      ? body.coupon_codes.filter((c: unknown): c is string => typeof c === "string").slice(0, 4)
      : typeof body?.coupon_code === "string"
        ? [body.coupon_code]
        : [];
    let discountCents = 0;
    let appliedCouponIds: string[] = [];
    let appliedCouponCodes: string[] = [];
    let discountPct = 0;
    if (rawCouponCodes.length > 0) {
      const tier = await resolveConsumerTier(user.id);
      const coupons = await fetchUserCouponsByCodes(user.id, rawCouponCodes);
      const selection = selectApplicableCoupons({
        tier,
        coupons,
        orderVendorId: product.vendor_id ?? null,
      });
      const discount = computeDiscountCents(lineTotalCents, selection.applied);
      discountCents = discount.discountCents;
      discountPct = discount.effectivePct;
      appliedCouponIds = selection.applied.map((c) => c.id);
      appliedCouponCodes = selection.applied.map((c) => c.code);
    }
    totalCents -= discountCents;
    const siteUrl = getSiteUrl(req);
    const vendorOwnerId = Array.isArray(product.vendors)
      ? (product.vendors as { owner_user_id: string }[])[0]?.owner_user_id
      : (product.vendors as { owner_user_id: string } | undefined)?.owner_user_id ?? null;

    let deliveryFees: Awaited<ReturnType<typeof computeDeliveryFees>> = null;
    if (fulfillmentMethod === "delivery") {
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

    const isDelivery = fulfillmentMethod === "delivery";
    const orderPayload: Record<string, unknown> = {
      user_id: user.id,
      vendor_id: product.vendor_id,
      status: "pending",
      total_cents: totalCents,
      currency: "usd",
      delivery_selected: isDelivery,
      fulfillment_method: fulfillmentMethod,
      delivery_status: isDelivery ? "unassigned" : null,
      discount_cents: discountCents,
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
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Notify vendor (admin client; order_notifications has no anon insert policy)
    const vendorId = product.vendor_id;
    if (vendorId) {
      const notifyMsg =
        fulfillmentMethod === "delivery"
          ? "New Delivery Order"
          : fulfillmentMethod === "shipping"
            ? "New Shipping Order"
            : "New Pickup Order";
      try {
        const admin = getSupabaseAdminClient();
        await admin.from("order_notifications").insert({
          vendor_id: vendorId,
          order_id: order.id,
          message: notifyMsg,
        });
      } catch (notifyErr) {
        console.warn("[checkout/create-session] vendor notification insert failed", notifyErr);
      }
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
      return NextResponse.json(
        { error: "Failed to create order item" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
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

    // Platform fee metadata (reserve-transfer model — see P0-1 note in
    // lib/billing/connectFees.ts). The FULL charge settles on the platform
    // account: no destination charge, no application_fee_amount. The
    // checkout.session.completed webhook reads platform_fee_cents from
    // metadata and queues a 7-day platform_reserve for vendor net; the
    // daily cron makes the ONE transfer to the vendor's Connect account.
    // Fee applies to PRODUCT subtotal only — delivery fees stay with the
    // platform (or pay out to drivers separately). Fee is computed from the
    // vendor's tier alone: a vendor mid-Connect-onboarding still accrues
    // reserves; the cron enforces Connect eligibility at transfer time.
    // Platform fee is computed on the DISCOUNTED product subtotal — the
    // charge that actually settles. Funding-split accounting (platform
    // absorbs platform-coupon discounts instead of the vendor) is a logged
    // follow-up; v1 keeps fee ∝ settled amount.
    const discountedSubtotalCents = lineTotalCents - discountCents;
    const adminForConnect = getSupabaseAdminClient();
    const platformFee = product.vendor_id
      ? await getPlatformFeeForCheckout(adminForConnect, {
          vendorId: product.vendor_id,
          productSubtotalCents: discountedSubtotalCents,
        })
      : null;

    // Stripe: apply the discount as a one-off amount_off coupon so the
    // charged total matches orders.total_cents (percent_off on the session
    // would also discount delivery fees — not allowed).
    let stripeDiscounts: Array<{ coupon: string }> | undefined;
    if (discountCents > 0) {
      const stripeCoupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency: "usd",
        duration: "once",
        name: `Member coupon${appliedCouponCodes.length > 1 ? "s" : ""} (${discountPct}% off items)`,
      });
      stripeDiscounts = [{ coupon: stripeCoupon.id }];
    }

    // Create Stripe checkout session
    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      ...(stripeDiscounts ? { discounts: stripeDiscounts } : {}),
      success_url: `${siteUrl}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/orders/cancel`,
      client_reference_id: user.id,
      metadata: {
        order_id: order.id,
        product_id: product.id,
        vendor_id: product.vendor_id || "",
        platform_fee_cents: platformFee ? String(platformFee.applicationFeeAmount) : "",
        platform_fee_tier: platformFee?.tier ?? "",
        platform_fee_bps: platformFee ? String(platformFee.feeBps) : "",
        coupon_ids: appliedCouponIds.join(","),
        discount_cents: discountCents > 0 ? String(discountCents) : "",
      },
    });

    // Update order with session ID
    await supabase
      .from("orders")
      .update({ checkout_session_id: stripeSession.id })
      .eq("id", order.id);

    return NextResponse.json({
      sessionId: stripeSession.id,
      url: stripeSession.url,
      applied_coupons: appliedCouponCodes,
      discount_cents: discountCents,
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
