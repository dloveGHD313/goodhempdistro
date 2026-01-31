import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

const QUERY_TIMEOUT_MS = 4000;
const SLOW_QUERY_MS = 1200;

const withTimeout = async <T,>(promise: PromiseLike<T>, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout`)), QUERY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const logIfSlow = (label: string, durationMs: number, requestId: string) => {
  if (durationMs < SLOW_QUERY_MS) return;
  console.warn(`[comments] requestId=${requestId} ${label} ${durationMs}ms`);
};

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const requestId = _req.headers.get("x-request-id") ?? crypto.randomUUID();
  const totalStart = Date.now();
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
    const started = Date.now();
    const response = (await withTimeout(
      supabase
        .from("post_comments")
        .update({ is_deleted: true, deleted_at: timestamp })
        .eq("id", commentId)
        .select("id")
        .maybeSingle(),
      "comment delete"
    )) as { data: { id: string } | null; error: { message?: string } | null };
    logIfSlow("comment_delete", Date.now() - started, requestId);
    data = response.data;
    error = response.error;
  } catch (err) {
    console.error("[comments] delete timeout", err);
    logIfSlow("comments_total", Date.now() - totalStart, requestId);
    return NextResponse.json({ error: "Comment delete timed out." }, { status: 504 });
  }

  if (error) {
    console.error("[comments] delete error", error);
    return NextResponse.json({ error: error.message ?? "Failed to delete comment" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Comment not found or not permitted" }, { status: 404 });
  }

  try {
    const started = Date.now();
    await withTimeout(
      supabase
        .from("post_comments")
        .update({ is_deleted: true, deleted_at: timestamp })
        .eq("parent_id", commentId),
      "reply delete"
    );
    logIfSlow("reply_delete", Date.now() - started, requestId);
  } catch (err) {
    console.error("[comments] reply delete timeout", err);
  }

  logIfSlow("comments_total", Date.now() - totalStart, requestId);
  return NextResponse.json({ ok: true });
}
