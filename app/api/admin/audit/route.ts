import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const LIMIT = 200;

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { searchParams } = new URL(req.url);
    const actionFilter = searchParams.get("action")?.trim() || null;
    const entityIdFilter = searchParams.get("entity_id")?.trim() || null;
    const actorEmailFilter = searchParams.get("actor_email")?.trim() || null;

    const admin = createSupabaseAdminClient();

    let query = admin
      .from("admin_action_logs")
      .select("id, created_at, actor_user_id, actor_email, action, entity_type, entity_id, prev_status, new_status, reason")
      .order("created_at", { ascending: false })
      .limit(LIMIT);

    if (actionFilter) query = query.eq("action", actionFilter);
    if (entityIdFilter) query = query.eq("entity_id", entityIdFilter);
    if (actorEmailFilter) query = query.ilike("actor_email", `%${actorEmailFilter}%`);

    const { data, error } = await query;

    if (error) {
      console.error("[admin/audit] list_error", error);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch audit log" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, data: data || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[admin/audit] unexpected_error", e);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
