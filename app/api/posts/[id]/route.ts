import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ error: "Post ID required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("posts")
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("is_deleted", false)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[posts] delete error", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Post not found or not permitted" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
