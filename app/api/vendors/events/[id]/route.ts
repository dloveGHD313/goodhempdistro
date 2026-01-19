import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * Get event details (vendor only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get vendor
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (!vendor) {
      return NextResponse.json({ error: "Vendor account required" }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();

    // Get event with ticket types
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("*, event_ticket_types(*)")
      .eq("id", id)
      .eq("vendor_id", vendor.id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Event GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Update event (vendor only)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify vendor
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (!vendor) {
      return NextResponse.json({ error: "Vendor account required" }, { status: 403 });
    }

    const {
      title,
      description,
      location,
      start_time,
      end_time,
      capacity,
      status,
    } = await req.json();

    const admin = getSupabaseAdminClient();

    // Verify event ownership
    const { data: existingEvent } = await admin
      .from("events")
      .select("id, vendor_id")
      .eq("id", id)
      .single();

    if (!existingEvent || existingEvent.vendor_id !== vendor.id) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Update event
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (location !== undefined) updates.location = location?.trim() || null;
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (capacity !== undefined) updates.capacity = capacity || null;
    if (status !== undefined) updates.status = status;

    const { error: updateError } = await admin
      .from("events")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      console.error("Error updating event:", updateError);
      return NextResponse.json(
        { error: "Failed to update event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Event PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
