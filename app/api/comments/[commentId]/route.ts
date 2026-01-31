import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
  const supabase = await createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  if (!commentId) {
    return NextResponse.json({ error: "Comment ID required" }, { status: 400 });
  }

  let debugAuthUid: string | null = null;
  try {
    const { data } = await supabase.rpc("debug_auth_uid");
    debugAuthUid = data ?? null;
  } catch {
    debugAuthUid = null;
  }

  let comment: { id: string; author_id: string } | null = null;
  try {
    const started = Date.now();
    const response = (await withTimeout(
      supabase
        .from("post_comments")
        .select("id, author_id")
        .eq("id", commentId)
        .maybeSingle(),
      "comment lookup"
    )) as { data: { id: string; author_id: string } | null; error: { message?: string } | null };
    logIfSlow("comment_lookup", Date.now() - started, requestId);
    if (response.error) {
      console.error("[comments] lookup error", response.error);
      return NextResponse.json({ error: response.error.message ?? "Failed to load comment" }, { status: 500 });
    }
    comment = response.data;
  } catch (err) {
    console.error("[comments] lookup timeout", err);
    logIfSlow("comments_total", Date.now() - totalStart, requestId);
    return NextResponse.json({ error: "Comment lookup timed out." }, { status: 504 });
  }

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  let isAdmin = false;
  try {
    const started = Date.now();
    const response = (await withTimeout(
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle(),
      "admin check"
    )) as { data: { role?: string | null } | null; error: { message?: string } | null };
    logIfSlow("admin_check", Date.now() - started, requestId);
    isAdmin = response.data?.role === "admin";
  } catch (err) {
    console.error("[comments] admin check timeout", err);
  }

  const isAuthor = comment.author_id === user.id;
  console.warn("[comments] delete auth", {
    requestId,
    commentId,
    userId: user.id,
    authUid: debugAuthUid,
    isAuthor,
    isAdmin,
  });

  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
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
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
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

async function createRouteHandlerClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // ignore if called from server component context
          }
        },
      },
    }
  );
}
