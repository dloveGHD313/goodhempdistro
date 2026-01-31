import { NextRequest, NextResponse } from "next/server";
import { applySupabaseCookies, createSupabaseRouteClient } from "@/lib/supabaseRoute";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { supabase, response } = createSupabaseRouteClient(req);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("[comments/delete] Auth error:", authError);
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    applySupabaseCookies(response, res);
    return res;
  }

  console.log("[comments/delete] Authenticated user:", user.id);
  try {
    const { data } = await supabase.rpc("debug_auth_uid");
    console.log("[comments/delete] debug_auth_uid:", data ?? null);
  } catch (err) {
    console.log("[comments/delete] debug_auth_uid failed");
  }

  const { commentId } = await params;
  if (!commentId) {
    const res = NextResponse.json({ error: "Comment ID required" }, { status: 400 });
    applySupabaseCookies(response, res);
    return res;
  }

  const { data: existingComment, error: existingError } = await supabase
    .from("post_comments")
    .select("id, author_id, post_id, parent_id")
    .eq("id", commentId)
    .maybeSingle();

  if (existingError) {
    const res = NextResponse.json(
      { error: "Failed to load comment", details: existingError.message },
      { status: 500 }
    );
    applySupabaseCookies(response, res);
    return res;
  }

  if (!existingComment) {
    const res = NextResponse.json({ error: "Comment not found" }, { status: 404 });
    applySupabaseCookies(response, res);
    return res;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    const res = NextResponse.json(
      { error: "Failed to verify admin status", details: profileError.message },
      { status: 500 }
    );
    applySupabaseCookies(response, res);
    return res;
  }
  const { data: adminRow, error: adminRowError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (adminRowError) {
    const res = NextResponse.json(
      { error: "Failed to verify admin status", details: adminRowError.message },
      { status: 500 }
    );
    applySupabaseCookies(response, res);
    return res;
  }
  const isAdmin = profile?.role === "admin" || !!adminRow;

  const { data: postRow, error: postError } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", existingComment.post_id)
    .maybeSingle();
  if (postError) {
    const res = NextResponse.json(
      { error: "Failed to verify post ownership", details: postError.message },
      { status: 500 }
    );
    applySupabaseCookies(response, res);
    return res;
  }
  const isPostOwner = postRow?.author_id === user.id;
  const isAuthor = existingComment.author_id === user.id;

  if (!isAdmin && !isAuthor && !isPostOwner) {
    const res = NextResponse.json({ error: "Not permitted" }, { status: 403 });
    applySupabaseCookies(response, res);
    return res;
  }

  console.log(
    "[comments/delete] Comment author:",
    existingComment.author_id,
    "Current user:",
    user.id
  );

  if (!isAdmin && !isPostOwner && !existingComment.parent_id) {
    const { data: otherReplies, error: replyCheckError } = await supabase
      .from("post_comments")
      .select("id, author_id")
      .eq("parent_id", commentId)
      .neq("author_id", user.id);
    if (replyCheckError) {
      const res = NextResponse.json(
        { error: "Failed to verify comment replies", details: replyCheckError.message },
        { status: 500 }
      );
      applySupabaseCookies(response, res);
      return res;
    }
    if (otherReplies && otherReplies.length > 0) {
      const res = NextResponse.json(
        { error: "Not permitted to delete comments with replies from other users" },
        { status: 403 }
      );
      applySupabaseCookies(response, res);
      return res;
    }
  }

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("post_comments")
    .update({ is_deleted: true, deleted_at: timestamp, deleted_by: user.id })
    .eq("id", commentId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[comments/delete] Update error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    if (error.code === "42501") {
      const res = NextResponse.json({ error: "Not permitted" }, { status: 403 });
      applySupabaseCookies(response, res);
      return res;
    }
    const res = NextResponse.json(
      { error: "Failed to delete comment", details: error.message },
      { status: 500 }
    );
    applySupabaseCookies(response, res);
    return res;
  }

  if (!data) {
    const res = NextResponse.json(
      { error: "Comment not found or not permitted" },
      { status: 404 }
    );
    applySupabaseCookies(response, res);
    return res;
  }

  if (!existingComment.parent_id) {
    const repliesQuery = supabase
      .from("post_comments")
      .update({ is_deleted: true, deleted_at: timestamp, deleted_by: user.id })
      .eq("parent_id", commentId);
    if (!isAdmin && !isPostOwner) {
      repliesQuery.eq("author_id", user.id);
    }
    const { error: repliesError } = await repliesQuery;

    if (repliesError) {
      console.error("[comments/delete] Replies deletion error:", repliesError);
      if (repliesError.code === "42501") {
        const res = NextResponse.json({ error: "Not permitted" }, { status: 403 });
        applySupabaseCookies(response, res);
        return res;
      }
    }
  }

  const res = NextResponse.json({ ok: true });
  applySupabaseCookies(response, res);
  return res;
}
