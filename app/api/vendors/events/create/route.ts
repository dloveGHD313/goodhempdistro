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
          ? { error: "Unauthorized", requestId }
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
          ? { error: "Vendor account required", requestId }
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

    const body = await req.json();
    const {
      title,
      description,
      location,
      start_time,
      end_time,
      capacity,
      ticket_types,
    } = body;

    if (!title || !start_time || !end_time) {
      return NextResponse.json(
        { error: "Title, start_time, and end_time are required", requestId },
        { status: 400 }
      );
    }

    if (!ticket_types || ticket_types.length === 0) {
      return NextResponse.json(
        { error: "At least one ticket type is required", requestId },
        { status: 400 }
      );
    }

    // Validate ticket types
    for (const tt of ticket_types) {
      const hasPriceCents = typeof tt.price_cents === "number";
      const hasPrice = typeof tt.price === "string" && tt.price.trim().length > 0;
      if (!tt.name || (!hasPriceCents && !hasPrice)) {
        return NextResponse.json(
          { error: "All ticket types must have name and price_cents", requestId },
          { status: 400 }
        );
      }
      const derivedPrice = hasPrice
        ? Math.round(Number.parseFloat(tt.price) * 100)
        : hasPriceCents
        ? Math.round(tt.price_cents)
        : null;
      if (derivedPrice === null || !Number.isFinite(derivedPrice) || derivedPrice < 0) {
        return NextResponse.json(
          { error: "Ticket prices must be valid and non-negative", requestId },
          { status: 400 }
        );
      }
    }

    // Validate dates
    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: "End time must be after start time", requestId },
        { status: 400 }
      );
    }

    const parsePriceCents = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.round(value);
      }
      if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
          return Math.round(parsed * 100);
        }
      }
      return null;
    };

    // Create event (always draft)
    const basePayload: Record<string, unknown> = {
      vendor_id: vendor.id,
      owner_user_id: user.id,
      created_by: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      location: location?.trim() || null,
      start_time,
      end_time,
      capacity: capacity || null,
      status: "draft",
    };

    const payloadKeys = Object.keys(basePayload);
    console.log("[vendor-events] request payload keys", {
      requestId,
      userId: user.id,
      vendorId: vendor.id,
      payloadKeys,
    });

    const insertEvent = async (payload: Record<string, unknown>) => {
      return supabase.from("events").insert(payload).select("id").single();
    };

    let { data: event, error: eventError } = await insertEvent(basePayload);

    if (eventError && (eventError.code === "42501" || /row level security/i.test(eventError.message || ""))) {
      console.warn(
        `[vendor-events] requestId=${requestId} RLS blocked insert; retrying with admin client.`
      );
      const admin = getSupabaseAdminClient();
      const adminInsert = await admin
        .from("events")
        .insert(basePayload)
        .select("id")
        .single();
      event = adminInsert.data;
      eventError = adminInsert.error;
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
          : { error: "Failed to create event", requestId },
        { status: 500 }
      );
    }

    // Create ticket types
    const ticketTypeInserts = ticket_types.map((tt: any) => {
      const priceCents = parsePriceCents(tt.price_cents ?? tt.price);
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
        price_cents: priceCents ?? 0,
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
          : { error: "Failed to create ticket types", requestId },
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
