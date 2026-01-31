import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { applySupabaseCookies, createSupabaseRouteClient } from "@/lib/supabaseRoute";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { supabase: routeSupabase, response } = createSupabaseRouteClient(req);

  const {
    data: { user },
    error: authError,
  } = await routeSupabase.auth.getUser();

  if (authError || !user) {
    console.error("[comments/delete] Auth error:", authError);
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    applySupabaseCookies(response, res);
    return res;
  }

  const { commentId } = await params;
  if (!commentId) {
    const res = NextResponse.json({ error: "Comment ID required" }, { status: 400 });
    applySupabaseCookies(response, res);
    return res;
  }

  const admin = createSupabaseAdminClient();

  const { data: comment, error: commentError } = await admin
    .from("post_comments")
    .select("id, author_id, post_id, parent_id, is_deleted")
    .eq("id", commentId)
    .maybeSingle();

  if (commentError) {
    console.error("[comments/delete] Comment lookup error:", commentError);
    const res = NextResponse.json(
      { error: "Failed to load comment", details: commentError.message },
      { status: 500 }
    );
    applySupabaseCookies(response, res);
    return res;
  }

  if (!comment) {
    const res = NextResponse.json({ error: "Comment not found" }, { status: 404 });
    applySupabaseCookies(response, res);
    return res;
  }

  const isAuthor = comment.author_id === user.id;

  const { data: adminRow } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = !!adminRow;

  const { data: post } = await admin
    .from("posts")
    .select("author_id")
    .eq("id", comment.post_id)
    .maybeSingle();
  const isPostOwner = post?.author_id === user.id;

  if (!isAdmin && !isAuthor && !isPostOwner) {
    const res = NextResponse.json({ error: "Not permitted" }, { status: 403 });
    applySupabaseCookies(response, res);
    return res;
  }

  const timestamp = new Date().toISOString();
  const { error: updateError } = await admin
    .from("post_comments")
    .update({
      is_deleted: true,
      deleted_at: timestamp,
      deleted_by: user.id,
    })
    .eq("id", commentId);

  if (updateError) {
    console.error("[comments/delete] Update error:", updateError);
    const res = NextResponse.json(
      { error: "Failed to delete comment", details: updateError.message },
      { status: 500 }
    );
    applySupabaseCookies(response, res);
    return res;
  }

  const res = NextResponse.json({ ok: true });
  applySupabaseCookies(response, res);
  return res;
}
