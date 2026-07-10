import { NextRequest, NextResponse } from "next/server";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { TicketPurchase } from "@/lib/events.types";
import { resolveConsumerTier } from "@/lib/entitlements";
import {
  eventTicketDiscountCents,
  freeEventTicketsRemaining,
  isTicketSalesOpenForTier,
} from "@/lib/events/perks";

/** Normalize email for guest checkout */
function parseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 512) return null;
  return trimmed;
}

/**
 * Create Stripe checkout session for event tickets.
 * Public: allows guest checkout when purchaser_email and age_confirmed_21 are provided.
 * Prevents overselling by checking inventory before creating order.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json().catch(() => ({}));
    const event_id = typeof body?.event_id === "string" ? body.event_id.trim() : null;
    const tickets = Array.isArray(body?.tickets) ? body.tickets : null;
    const purchaser_email = parseEmail(body?.purchaser_email);
    const age_confirmed_21 = body?.age_confirmed_21 === true;

    if (!event_id || !tickets || tickets.length === 0) {
      return NextResponse.json(
        { error: "event_id and tickets array are required" },
        { status: 400 }
      );
    }

    const isGuest = !user;
    if (!age_confirmed_21) {
      return NextResponse.json(
        { error: "You must confirm you are 21 or older to purchase event tickets" },
        { status: 400 }
      );
    }
    if (isGuest) {
      if (!purchaser_email) {
        return NextResponse.json(
          { error: "Guest checkout requires purchaser_email" },
          { status: 400 }
        );
      }
    }

    const normalizedTickets: TicketPurchase[] = tickets
      .filter((t: unknown) => t && typeof t === "object" && typeof (t as { ticket_type_id?: unknown }).ticket_type_id === "string" && typeof (t as { quantity?: unknown }).quantity === "number")
      .map((t: { ticket_type_id: string; quantity: number }) => ({
        ticket_type_id: (t.ticket_type_id as string).trim(),
        quantity: Math.floor(Number((t as { quantity: number }).quantity)) || 0,
      }))
      .filter((t: TicketPurchase) => t.quantity > 0);

    if (normalizedTickets.length === 0) {
      return NextResponse.json(
        { error: "At least one ticket with quantity > 0 is required" },
        { status: 400 }
      );
    }

    // Fetch event and ticket types with admin client to ensure we can read draft events if needed
    const admin = getSupabaseAdminClient();
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, title, capacity, tickets_sold, status, tickets_on_sale_at")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status !== "published") {
      return NextResponse.json(
        { error: "Event is not available for ticket purchases" },
        { status: 400 }
      );
    }

    // Event perks (spec 2026-07-10 §7): resolve the buyer's tier once —
    // guests are Free. Drives the early on-sale window, the tier discount,
    // and the Premium free-quarterly-ticket perk below.
    const tier = user ? await resolveConsumerTier(user.id) : "Free";

    // Early on-sale window: Plus 24h / Premium 48h before the public time.
    const salesWindow = isTicketSalesOpenForTier(
      event.tickets_on_sale_at ?? null,
      tier
    );
    if (!salesWindow.open) {
      return NextResponse.json(
        {
          code: "TICKETS_NOT_ON_SALE",
          error: "Tickets are not on sale yet for your membership level.",
          opens_at: salesWindow.opensAt?.toISOString() ?? null,
        },
        { status: 403 }
      );
    }

    // Fetch ticket types and check inventory
    const ticketTypeIds = normalizedTickets.map((t) => t.ticket_type_id);
    const { data: ticketTypes, error: ticketTypesError } = await admin
      .from("event_ticket_types")
      .select("id, name, price_cents, quantity, sold")
      .in("id", ticketTypeIds);

    if (ticketTypesError || !ticketTypes || ticketTypes.length !== ticketTypeIds.length) {
      return NextResponse.json({ error: "Invalid ticket types" }, { status: 400 });
    }

    // Check inventory for each ticket type
    const ticketTypeMap = new Map(ticketTypes.map((tt) => [tt.id, tt]));
    let totalCents = 0;

    for (const purchase of normalizedTickets) {
      const ticketType = ticketTypeMap.get(purchase.ticket_type_id);
      if (!ticketType) {
        return NextResponse.json(
          { error: `Ticket type ${purchase.ticket_type_id} not found` },
          { status: 400 }
        );
      }

      // Check if ticket type has quantity limit
      if (ticketType.quantity !== null) {
        const remaining = ticketType.quantity - ticketType.sold;
        if (remaining < purchase.quantity) {
          return NextResponse.json(
            { error: `Insufficient tickets available for ${ticketType.name}. Only ${remaining} remaining.` },
            { status: 400 }
          );
        }
      }

      // Check event capacity
      if (event.capacity !== null) {
        const remainingCapacity = event.capacity - event.tickets_sold;
        if (remainingCapacity < purchase.quantity) {
          return NextResponse.json(
            { error: `Event capacity exceeded. Only ${remainingCapacity} tickets remaining.` },
            { status: 400 }
          );
        }
      }

      totalCents += ticketType.price_cents * purchase.quantity;
    }

    // Tier discount (0/5/10/20%) on the ticket subtotal, floor rounding.
    // Premium may additionally redeem 1 free community-event ticket per
    // quarter (cheapest single ticket in the order becomes free; redemption
    // is recorded by the paid webhook so abandoned checkouts don't burn it).
    const discountPctCents = eventTicketDiscountCents(totalCents, tier);
    let freeTicketCents = 0;
    const wantsFreeTicket = body?.use_free_quarterly_ticket === true;
    if (wantsFreeTicket && user) {
      const remaining = await freeEventTicketsRemaining(user.id, tier);
      if (remaining > 0) {
        const cheapestTicketCents = Math.min(
          ...normalizedTickets.map(
            (t) => ticketTypeMap.get(t.ticket_type_id)!.price_cents
          )
        );
        if (Number.isFinite(cheapestTicketCents) && cheapestTicketCents > 0) {
          freeTicketCents = cheapestTicketCents;
        }
      }
    }
    // Stripe payment-mode sessions can't charge $0 — keep at least the
    // 50¢ card minimum when a free ticket + discount would zero the order.
    const maxDiscount = Math.max(totalCents - 50, 0);
    const discountCents = Math.min(discountPctCents + freeTicketCents, maxDiscount);
    totalCents -= discountCents;

    const orderUserId = user?.id ?? null;
    const orderEmail = isGuest ? purchaser_email : null;

    // Create pending event order (guest: user_id null, purchaser_email set)
    const insertPayload: { user_id: string | null; event_id: string; total_cents: number; status: string; discount_cents: number; purchaser_email?: string | null } = {
      user_id: orderUserId,
      event_id: event_id,
      total_cents: totalCents,
      status: "pending",
      discount_cents: discountCents,
    };
    if (orderEmail) insertPayload.purchaser_email = orderEmail;

    const { data: eventOrder, error: orderError } = await admin
      .from("event_orders")
      .insert(insertPayload)
      .select("id")
      .single();

    if (orderError || !eventOrder) {
      console.error("Error creating event order:", orderError);
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

    // Create order items
    const orderItems = normalizedTickets.map((purchase) => {
      const ticketType = ticketTypeMap.get(purchase.ticket_type_id)!;
      return {
        event_order_id: eventOrder.id,
        ticket_type_id: purchase.ticket_type_id,
        quantity: purchase.quantity,
        price_cents: ticketType.price_cents,
      };
    });

    const { error: itemsError } = await admin
      .from("event_order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Error creating event order items:", itemsError);
      // Cleanup order if items fail
      await admin.from("event_orders").delete().eq("id", eventOrder.id);
      return NextResponse.json(
        { error: "Failed to create order items" },
        { status: 500 }
      );
    }

    // Create Stripe checkout session
    const siteUrl = getSiteUrl(req);
    const lineItems = normalizedTickets.map((purchase) => {
      const ticketType = ticketTypeMap.get(purchase.ticket_type_id)!;
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${event.title} - ${ticketType.name}`,
          },
          unit_amount: ticketType.price_cents,
        },
        quantity: purchase.quantity,
      };
    });

    // Apply the tier discount (+ free quarterly ticket) as a one-off
    // amount_off coupon so the charge matches event_orders.total_cents.
    let stripeDiscounts: Array<{ coupon: string }> | undefined;
    if (discountCents > 0) {
      const stripeCoupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency: "usd",
        duration: "once",
        name: freeTicketCents > 0 ? "Member perk (incl. free ticket)" : "Member ticket discount",
      });
      stripeDiscounts = [{ coupon: stripeCoupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      ...(stripeDiscounts ? { discounts: stripeDiscounts } : {}),
      success_url: `${siteUrl}/events/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/events/checkout/cancel`,
      metadata: {
        event_id: event_id,
        order_id: eventOrder.id,
        order_type: "event",
        ...(orderUserId ? { user_id: orderUserId } : {}),
        ...(freeTicketCents > 0
          ? { free_ticket_cents: String(freeTicketCents) }
          : {}),
      },
      ...(orderEmail ? { customer_email: orderEmail } : {}),
    });

    // Update order with session ID
    await admin
      .from("event_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", eventOrder.id);

    return NextResponse.json({ session_id: session.id, url: session.url });
  } catch (error) {
    console.error("Event checkout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
