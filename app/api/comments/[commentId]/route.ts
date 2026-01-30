import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  if (!commentId) {
    return NextResponse.json({ error: "Comment ID required" }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("post_comments")
    .update({ is_deleted: true, deleted_at: timestamp })
    .eq("id", commentId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[comments] delete error", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Comment not found or not permitted" }, { status: 404 });
  }

  await supabase
    .from("post_comments")
    .update({ is_deleted: true, deleted_at: timestamp })
    .eq("parent_id", commentId);

  return NextResponse.json({ ok: true });
}
