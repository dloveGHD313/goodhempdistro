import { NextRequest, NextResponse } from "next/server";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import type { TicketPurchase } from "@/lib/events.types";

/**
 * Create Stripe checkout session for event tickets
 * Prevents overselling by checking inventory before creating order
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { event_id, tickets }: { event_id: string; tickets: TicketPurchase[] } = await req.json();

    if (!event_id || !tickets || tickets.length === 0) {
      return NextResponse.json(
        { error: "event_id and tickets array are required" },
        { status: 400 }
      );
    }

    // Fetch event and ticket types with admin client to ensure we can read draft events if needed
    const admin = getSupabaseAdminClient();
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, title, capacity, tickets_sold, status")
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

    // Fetch ticket types and check inventory
    const ticketTypeIds = tickets.map((t) => t.ticket_type_id);
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

    for (const purchase of tickets) {
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

    // Create pending event order
    const { data: eventOrder, error: orderError } = await admin
      .from("event_orders")
      .insert({
        user_id: user.id,
        event_id: event_id,
        total_cents: totalCents,
        status: "pending",
      })
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
    const orderItems = tickets.map((purchase) => {
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
    const lineItems = tickets.map((purchase) => {
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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${siteUrl}/events/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/orders/cancel`,
      metadata: {
        event_id: event_id,
        order_id: eventOrder.id,
        user_id: user.id,
        order_type: "event",
      },
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
