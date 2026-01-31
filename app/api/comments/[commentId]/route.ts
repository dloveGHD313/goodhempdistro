import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("[comments/delete] Auth error:", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "Comment ID required" }, { status: 400 });
  }

  const { data: existingComment } = await supabase
    .from("post_comments")
    .select("id, author_id, parent_id")
    .eq("id", commentId)
    .maybeSingle();

  if (!existingComment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";
  const isAuthor = existingComment.author_id === user.id;

  if (!isAdmin && !isAuthor) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  console.log(
    "[comments/delete] Comment author:",
    existingComment.author_id,
    "Current user:",
    user.id
  );

  if (!isAdmin && !existingComment.parent_id) {
    const { data: otherReplies, error: replyCheckError } = await supabase
      .from("post_comments")
      .select("id, author_id")
      .eq("parent_id", commentId)
      .neq("author_id", user.id);
    if (replyCheckError) {
      return NextResponse.json(
        { error: "Failed to verify comment replies", details: replyCheckError.message },
        { status: 500 }
      );
    }
    if (otherReplies && otherReplies.length > 0) {
      return NextResponse.json(
        { error: "Not permitted to delete comments with replies from other users" },
        { status: 403 }
      );
    }
  }

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("post_comments")
    .update({ is_deleted: true, deleted_at: timestamp })
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
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to delete comment", details: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Comment not found or not permitted" },
      { status: 404 }
    );
  }

  if (!existingComment.parent_id && isAdmin) {
    const { error: repliesError } = await supabase
      .from("post_comments")
      .update({ is_deleted: true, deleted_at: timestamp })
      .eq("parent_id", commentId);

    if (repliesError) {
      console.error("[comments/delete] Replies deletion error:", repliesError);
      if (repliesError.code === "42501") {
        return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
