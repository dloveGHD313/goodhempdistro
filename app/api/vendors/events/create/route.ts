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
    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    console.log(
      `[vendor-events] requestId=${requestId} SSR user check: ${
        user ? `found ${user.id} (${user.email})` : "not found"
      }`
    );

    if (userError || !user) {
      console.error(`[vendor-events] requestId=${requestId} Auth error:`, {
        message: userError?.message,
        details: (userError as { details?: string })?.details,
      });
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Unauthorized" }
          : { requestId, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Verify vendor
    let { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, owner_user_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (vendorError) {
      console.error("[vendor-events] Vendor query error (user client):", {
        requestId,
        message: vendorError.message,
        details: vendorError.details,
        hint: vendorError.hint,
        code: vendorError.code,
      });
      const admin = getSupabaseAdminClient();
      const { data: adminVendor, error: adminVendorError } = await admin
        .from("vendors")
        .select("id, owner_user_id")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (adminVendorError) {
        console.error("[vendor-events] Vendor query error (admin client):", {
          requestId,
          message: adminVendorError.message,
          details: adminVendorError.details,
          hint: adminVendorError.hint,
          code: adminVendorError.code,
        });
      } else {
        vendor = adminVendor;
        vendorError = null;
      }
    }

    if (vendorError || !vendor) {
      return NextResponse.json(
        process.env.NODE_ENV === "production"
          ? { error: "Vendor account required" }
          : { requestId, error: "Vendor account required" },
        { status: 403 }
      );
    }

    console.log("[vendor-events] Vendor lookup result", {
      requestId,
      userId: user.id,
      vendorFound: !!vendor,
      vendorId: vendor?.id || null,
    });

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

    // Create event
    const safeStatus = status === "pending_review" ? "pending_review" : "draft";

    const getMissingColumn = (message?: string | null) => {
      if (!message) {
        return null;
      }
      const match = message.match(/column \"([^\"]+)\" does not exist/i);
      return match?.[1] || null;
    };

    const basePayload = {
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
    };

    const insertEvent = async (payload: Record<string, any>) => {
      return supabase.from("events").insert(payload).select("id").single();
    };

    let payload: Record<string, any> = { ...basePayload };
    let { data: event, error: eventError } = await insertEvent(payload);

    // Legacy schema fallback: strip missing columns and retry exactly once
    const missingColumn = getMissingColumn(eventError?.message);
    if (eventError && missingColumn) {
      const colsToRemove = new Set<string>([missingColumn]);
      // Legacy schemas often miss both owner_user_id and submitted_at together
      if (missingColumn === "owner_user_id") {
        colsToRemove.add("submitted_at");
      }
      for (const col of colsToRemove) {
        delete payload[col];
      }

      const retry = await insertEvent(payload);
      event = retry.data;
      eventError = retry.error;
    }

    if (eventError || !event) {
      console.error("Error creating event:", {
        requestId,
        message: eventError?.message,
        details: eventError?.details,
        hint: eventError?.hint,
        code: eventError?.code,
      });
      const includeDetails = process.env.NODE_ENV !== "production";
      return NextResponse.json(
        includeDetails
          ? {
              requestId,
              error: "Failed to create event",
              debug: {
                supabase_code: eventError?.code,
                message: eventError?.message,
                details: eventError?.details,
                hint: eventError?.hint,
              },
            }
          : { error: "Failed to create event" },
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

    const { error: ticketTypesError } = await supabase
      .from("event_ticket_types")
      .insert(ticketTypeInserts);

    if (ticketTypesError) {
      console.error("Error creating ticket types:", {
        requestId,
        message: ticketTypesError.message,
        details: ticketTypesError.details,
        hint: ticketTypesError.hint,
        code: ticketTypesError.code,
      });
      const includeDetails = process.env.NODE_ENV !== "production";
      // Cleanup event
      await supabase.from("events").delete().eq("id", event.id);
      return NextResponse.json(
        includeDetails
          ? {
              requestId,
              error: "Failed to create ticket types",
              debug: {
                supabase_code: ticketTypesError.code,
                message: ticketTypesError.message,
                details: ticketTypesError.details,
                hint: ticketTypesError.hint,
              },
            }
          : { error: "Failed to create ticket types" },
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
