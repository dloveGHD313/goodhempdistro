import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

const getLikesCount = async (
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  postId: string
) => {
  const { count } = await supabase
    .from("post_likes")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  return count || 0;
};

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ error: "Post ID required" }, { status: 400 });
  }

  const { error } = await supabase.from("post_likes").insert({
    post_id: postId,
    user_id: user.id,
  });

  if (error && (error as { code?: string }).code !== "23505") {
    console.error("[post_likes] insert error", error);
    return NextResponse.json({ error: "Failed to like post" }, { status: 500 });
  }

  const likesCount = await getLikesCount(supabase, postId);
  return NextResponse.json({ ok: true, likes_count: likesCount });
}

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

  const { error } = await supabase
    .from("post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[post_likes] delete error", error);
    return NextResponse.json({ error: "Failed to unlike post" }, { status: 500 });
  }

  const likesCount = await getLikesCount(supabase, postId);
  return NextResponse.json({ ok: true, likes_count: likesCount });
}
