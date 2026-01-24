import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * Create event with ticket types
 * Vendor-only endpoint
 */
export async function POST(req: NextRequest) {
  try {
    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
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
      const hasPriceCents = typeof tt.price_cents === "number";
      const hasPrice = typeof tt.price === "string" && tt.price.trim().length > 0;
      const derivedPrice = hasPrice ? Math.round(parseFloat(tt.price) * 100) : null;
      const isValidPrice =
        (hasPriceCents && Number.isFinite(tt.price_cents) && tt.price_cents >= 0) ||
        (hasPrice && derivedPrice !== null && Number.isFinite(derivedPrice) && derivedPrice >= 0);
      if (!tt.name || (!hasPriceCents && !hasPrice) || !isValidPrice) {
        return NextResponse.json(
          { error: "All ticket types must have a name and price" },
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
    const safeStatus = "draft";

    const getMissingColumns = (message?: string | null) => {
      if (!message) {
        return [];
      }
      const matches = Array.from(
        message.matchAll(/column \"([^\"]+)\" does not exist/gi)
      );
      return matches.map((match) => match[1]).filter(Boolean);
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
      submitted_at: null,
    };

    const insertEvent = async (payload: typeof basePayload) => {
      return supabase.from("events").insert(payload).select("id").single();
    };

    const payload = { ...basePayload };
    let { data: event, error: eventError } = await insertEvent(payload);

    const missingColumns = getMissingColumns(eventError?.message);
    if (eventError && missingColumns.length > 0) {
      const retryPayload = { ...payload } as Record<string, unknown>;
      if (missingColumns.includes("owner_user_id")) {
        delete retryPayload.owner_user_id;
        delete retryPayload.submitted_at;
      }
      missingColumns.forEach((column) => {
        delete retryPayload[column];
      });
      const retry = await insertEvent(retryPayload as typeof basePayload);
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
    const ticketTypeInserts = ticket_types.map((tt: any) => {
      const priceCents =
        typeof tt.price_cents === "number"
          ? tt.price_cents
          : Math.round(parseFloat(tt.price) * 100);
      const rawQuantity =
        tt.quantity === null || tt.quantity === undefined || tt.quantity === ""
          ? null
          : Number(tt.quantity);
      const quantityValue =
        typeof rawQuantity === "number" && Number.isFinite(rawQuantity) && rawQuantity > 0
          ? rawQuantity
          : null;
      return {
        event_id: event.id,
        name: tt.name.trim(),
        price_cents: priceCents,
        quantity: quantityValue,
        sold: 0,
      };
    });

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

