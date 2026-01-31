import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { applySupabaseCookies, createSupabaseRouteClient } from "@/lib/supabaseRoute";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { supabase: routeSupabase, response } = createSupabaseRouteClient(req);
  const { user, isAdmin } = await requireAdminUsers(req);

  if (!user) {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    applySupabaseCookies(response, res);
    return res;
  }
  if (!isAdmin) {
    const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    applySupabaseCookies(response, res);
    return res;
  }

  const { commentId } = await params;
  if (!commentId) {
    return NextResponse.json({ error: "Comment ID required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (typeof body.is_pinned === "boolean") updates.is_pinned = body.is_pinned;
  if (typeof body.is_featured === "boolean") updates.is_featured = body.is_featured;
  if (typeof body.priority_rank === "number") updates.priority_rank = body.priority_rank;
  if (typeof body.is_locked === "boolean") updates.is_locked = body.is_locked;
  if (body.moderation_note !== undefined) updates.moderation_note = body.moderation_note;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (body.is_deleted === true) {
    updates.is_deleted = true;
    updates.deleted_at = new Date().toISOString();
    updates.deleted_by = user.id;
  } else if (body.is_deleted === false) {
    updates.is_deleted = false;
    updates.deleted_at = null;
    updates.deleted_by = null;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("post_comments")
    .update(updates)
    .eq("id", commentId);

  if (error) {
    console.error("[admin/moderation/comments] update error:", error);
    const res = NextResponse.json(
      { error: "Failed to update comment", details: error.message },
      { status: 500 }
    );
    applySupabaseCookies(response, res);
    return res;
  }

  const res = NextResponse.json({ ok: true });
  applySupabaseCookies(response, res);
  return res;
}
