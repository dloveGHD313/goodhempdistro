import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

const QUERY_TIMEOUT_MS = 4000;

const withTimeout = async <T,>(promise: Promise<T>, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout`)), QUERY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

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
  let data: { id: string } | null = null;
  let error: { message?: string } | null = null;
  try {
    ({ data, error } = await withTimeout(
      supabase
        .from("post_comments")
        .update({ is_deleted: true, deleted_at: timestamp })
        .eq("id", commentId)
        .select("id")
        .maybeSingle(),
      "comment delete"
    ));
  } catch (err) {
    console.error("[comments] delete timeout", err);
    return NextResponse.json({ error: "Comment delete timed out." }, { status: 504 });
  }

  if (error) {
    console.error("[comments] delete error", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Comment not found or not permitted" }, { status: 404 });
  }

  try {
    await withTimeout(
      supabase
        .from("post_comments")
        .update({ is_deleted: true, deleted_at: timestamp })
        .eq("parent_id", commentId),
      "reply delete"
    );
  } catch (err) {
    console.error("[comments] reply delete timeout", err);
  }

  return NextResponse.json({ ok: true });
}
