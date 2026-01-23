import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * Create event with ticket types
 * Vendor-only endpoint
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify vendor
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (vendorError || !vendor) {
      return NextResponse.json(
        { error: "Vendor account required" },
        { status: 403 }
      );
    }

    const {
      title,
      description,
      location,
      start_time,
      end_time,
      capacity,
      status = "draft",
      ticket_types,
    } = await req.json();

    if (!title || !start_time || !end_time) {
      return NextResponse.json(
        { error: "Title, start_time, and end_time are required" },
        { status: 400 }
      );
    }

    if (!ticket_types || ticket_types.length === 0) {
      return NextResponse.json(
        { error: "At least one ticket type is required" },
        { status: 400 }
      );
    }

    // Validate ticket types
    for (const tt of ticket_types) {
      if (!tt.name || tt.price_cents === undefined) {
        return NextResponse.json(
          { error: "All ticket types must have name and price_cents" },
          { status: 400 }
        );
      }
    }

    // Validate dates
    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();

    // Create event
    const safeStatus = status === "pending_review" ? "pending_review" : "draft";

    const { data: event, error: eventError } = await admin
      .from("events")
      .insert({
        vendor_id: vendor.id,
        owner_user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        start_time,
        end_time,
        capacity: capacity || null,
        status: safeStatus,
        submitted_at: safeStatus === "pending_review" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (eventError || !event) {
      console.error("Error creating event:", eventError);
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      );
    }

    // Create ticket types
    const ticketTypeInserts = ticket_types.map((tt: any) => ({
      event_id: event.id,
      name: tt.name.trim(),
      price_cents: tt.price_cents,
      quantity: tt.quantity || null,
      sold: 0,
    }));

    const { error: ticketTypesError } = await admin
      .from("event_ticket_types")
      .insert(ticketTypeInserts);

    if (ticketTypesError) {
      console.error("Error creating ticket types:", ticketTypesError);
      // Cleanup event
      await admin.from("events").delete().eq("id", event.id);
      return NextResponse.json(
        { error: "Failed to create ticket types" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, event_id: event.id }, { status: 201 });
  } catch (error) {
    console.error("Event creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
