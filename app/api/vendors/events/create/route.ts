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

    const fetchColumnSet = async (tableName: string) => {
      try {
        const { data, error } = await supabase
          .schema("information_schema")
          .from("columns")
          .select("column_name")
          .eq("table_schema", "public")
          .eq("table_name", tableName);

        if (error || !data) {
          return null;
        }

        return new Set(data.map((row) => row.column_name));
      } catch (error) {
        console.warn(
          `[vendor-events] requestId=${requestId} Failed to read schema for ${tableName}:`,
          error
        );
        return null;
      }
    };

    const filterPayload = (
      payload: Record<string, unknown>,
      columnSet: Set<string> | null
    ) => {
      if (!columnSet) {
        return payload;
      }
      return Object.fromEntries(
        Object.entries(payload).filter(([key]) => columnSet.has(key))
      );
    };

    const getMissingColumns = (error?: { message?: string | null; details?: string | null }) => {
      const sources = [error?.message, error?.details].filter(Boolean) as string[];
      const matches = new Set<string>();
      sources.forEach((source) => {
        for (const match of source.matchAll(/column \"([^\"]+)\" does not exist/gi)) {
          matches.add(match[1]);
        }
      });
      return Array.from(matches);
    };

    // Create event (always draft)
    const basePayload: Record<string, unknown> = {
      vendor_id: vendor.id,
      owner_user_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      location: location?.trim() || null,
      start_time,
      end_time,
      capacity: capacity || null,
      status: "draft",
    };

    const insertEvent = async (payload: Record<string, unknown>) => {
      return supabase.from("events").insert(payload).select("id").single();
    };

    const eventColumns = await fetchColumnSet("events");
    let payload: Record<string, unknown> = filterPayload(basePayload, eventColumns);
    let { data: event, error: eventError } = await insertEvent(payload);

    // Legacy schema fallback: strip missing columns and retry exactly once
    const missingColumns = getMissingColumns(eventError || undefined);
    if (eventError && missingColumns.length > 0) {
      missingColumns.forEach((column) => {
        delete payload[column];
      });
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
    const ticketColumns = await fetchColumnSet("event_ticket_types");
    const ticketTypeInserts = ticket_types.map((tt: any) =>
      filterPayload(
        {
          event_id: event.id,
          name: tt.name.trim(),
          price_cents: tt.price_cents,
          quantity: tt.quantity || null,
          sold: 0,
        },
        ticketColumns
      )
    );

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
