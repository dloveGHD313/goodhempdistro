import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";

export async function GET() {
  const requestId = crypto.randomUUID();
  const logStage = (stage: string, details?: Record<string, unknown>) => {
    console.log(`[admin/diagnostics][${requestId}] ${stage}`, details || {});
  };
  try {
    logStage("start");
    const supabase = await createSupabaseServerClient();
    const { user, profile } = await getCurrentUserProfile(supabase);

    if (!user) {
      logStage("auth_missing");
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!isAdmin(profile)) {
      logStage("auth_forbidden", { userId: user.id });
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = createSupabaseAdminClient();
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/https?:\/\//, "");

    const countByStatus = async (table: "products" | "events") => {
      const fetchCount = async (status: string) => {
        const { count } = await admin
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("status", status);
        return count || 0;
      };
      const [pending, approved, rejected, draft, total] = await Promise.all([
        fetchCount("pending_review"),
        fetchCount("approved"),
        fetchCount("rejected"),
        fetchCount("draft"),
        admin.from(table).select("*", { count: "exact", head: true }).then(({ count }) => count || 0),
      ]);
      return { total, pending, approved, rejected, draft };
    };

    logStage("fetch_counts");
    const [productCounts, eventCounts] = await Promise.all([
      countByStatus("products"),
      countByStatus("events"),
    ]);

    const latestProducts = await admin
      .from("products")
      .select("id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    const latestEvents = await admin
      .from("events")
      .select("id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (latestProducts.error) {
      console.error(`[admin/diagnostics][${requestId}] latest_products_error`, {
        code: latestProducts.error.code,
        message: latestProducts.error.message,
        details: latestProducts.error.details,
        hint: latestProducts.error.hint,
      });
    }
    if (latestEvents.error) {
      console.error(`[admin/diagnostics][${requestId}] latest_events_error`, {
        code: latestEvents.error.code,
        message: latestEvents.error.message,
        details: latestEvents.error.details,
        hint: latestEvents.error.hint,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        supabaseUrl,
        products: productCounts,
        events: eventCounts,
        latestProducts: latestProducts.data || [],
        latestEvents: latestEvents.data || [],
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[admin/diagnostics][${requestId}] unexpected_error`, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
