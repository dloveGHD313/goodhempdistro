import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, profile } = await getCurrentUserProfile(supabase);

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin(profile)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
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

    const [productCounts, eventCounts, latestProducts, latestEvents] = await Promise.all([
      countByStatus("products"),
      countByStatus("events"),
      admin
        .from("products")
        .select("id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("events")
        .select("id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return NextResponse.json({
      ok: true,
      supabaseUrl,
      products: productCounts,
      events: eventCounts,
      latestProducts: latestProducts.data || [],
      latestEvents: latestEvents.data || [],
    });
  } catch (error) {
    console.error("[api/admin/diagnostics] error", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
