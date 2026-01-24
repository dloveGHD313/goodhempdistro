import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const admin = getSupabaseAdminClient();

    const fetchColumns = async (tableName: string) => {
      const { data, error } = await admin
        .schema("information_schema")
        .from("columns")
        .select("column_name")
        .eq("table_schema", "public")
        .eq("table_name", tableName);

      if (error) {
        throw error;
      }

      return (data || []).map((row) => row.column_name).sort();
    };

    const [products, events, eventTicketTypes] = await Promise.all([
      fetchColumns("products"),
      fetchColumns("events"),
      fetchColumns("event_ticket_types"),
    ]);

    return NextResponse.json(
      {
        products,
        events,
        event_ticket_types: eventTicketTypes,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[admin/diag/schema] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
