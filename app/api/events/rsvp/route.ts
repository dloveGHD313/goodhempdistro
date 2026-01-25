import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

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
    const eventId = typeof body?.event_id === "string" ? body.event_id : null;

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, status, capacity, tickets_sold")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (event.status !== "published") {
      return NextResponse.json(
        { error: "Event is not available" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: existingOrder } = await admin
      .from("event_orders")
      .select("id, status")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingOrder && existingOrder.status !== "cancelled") {
      return NextResponse.json(
        { success: true, status: existingOrder.status, message: "RSVP already recorded." },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (event.capacity !== null && event.tickets_sold >= event.capacity) {
      return NextResponse.json(
        { error: "Event is sold out" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: order, error: orderError } = await admin
      .from("event_orders")
      .insert({
        user_id: user.id,
        event_id: eventId,
        total_cents: 0,
        status: "paid",
      })
      .select("id, status")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Failed to record RSVP" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    await admin
      .from("events")
      .update({
        tickets_sold: (event.tickets_sold || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    return NextResponse.json(
      { success: true, status: order.status, message: "RSVP confirmed." },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[events/rsvp] Error confirming RSVP", error);
    return NextResponse.json(
      { error: "Failed to record RSVP" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
