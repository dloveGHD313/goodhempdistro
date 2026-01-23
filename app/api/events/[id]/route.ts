import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Get published event with ticket types (public endpoint)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await params;

    const { data: event, error } = await supabase
      .from("events")
      .select("id, title, description, location, start_time, end_time, capacity, tickets_sold, vendor_id")
      .eq("id", id)
      .in("status", ["approved", "published"])
      .single();

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const { data: ticketTypes } = await supabase
      .from("event_ticket_types")
      .select("id, name, price_cents, quantity, sold")
      .eq("event_id", event.id)
      .order("price_cents", { ascending: true });

    let vendor = null;
    if (event.vendor_id) {
      const { data: vendorData } = await supabase
        .from("vendors")
        .select("business_name")
        .eq("id", event.vendor_id)
        .eq("is_active", true)
        .eq("is_approved", true)
        .maybeSingle();
      vendor = vendorData || null;
    }

    return NextResponse.json({
      event: {
        ...event,
        event_ticket_types: ticketTypes || [],
        vendors: vendor,
      },
    });
  } catch (error) {
    console.error("Event GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
