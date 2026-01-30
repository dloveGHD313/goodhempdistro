import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getDisplayName } from "@/lib/identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const QUERY_TIMEOUT_MS = 4000;
const SLOW_QUERY_MS = 1200;

type ProfileIdentityRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  border_style: string | null;
  role: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  author_id: string;
};

const createAnonServerClient = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          return;
        },
      },
    }
  );
};

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

const getProfileMap = async (authorIds: string[]) => {
  if (authorIds.length === 0) return new Map<string, ProfileIdentityRow>();
  const anon = createAnonServerClient();
  const { data } = await withTimeout(
    anon.rpc("get_profiles_identity", { author_ids: authorIds }),
    "profile identity"
  );
  return new Map(
    ((data || []) as ProfileIdentityRow[]).map((row) => [row.id, row])
  );
};

const mapComment = (comment: CommentRow, profileMap: Map<string, ProfileIdentityRow>) => {
  const profile = profileMap.get(comment.author_id);
  return {
    id: comment.id,
    postId: comment.post_id,
    parentId: comment.parent_id,
    body: comment.body,
    createdAt: comment.created_at,
    authorId: comment.author_id,
    authorDisplayName: getDisplayName(
      {
        id: profile?.id ?? comment.author_id,
        display_name: profile?.display_name ?? null,
        username: profile?.username ?? null,
      },
      null
    ),
    authorAvatarUrl: profile?.avatar_url ?? null,
    authorBadgeModel: null,
  };
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = _req.headers.get("x-request-id") ?? crypto.randomUUID();
  const totalStart = Date.now();
  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ error: "Post ID required" }, { status: 400 });
  }

  const anon = createAnonServerClient();
  let comments: CommentRow[] | null = null;
  let error: { message?: string } | null = null;
  try {
    const started = Date.now();
    ({ data: comments, error } = await withTimeout(
      anon
        .from("post_comments")
        .select("id, post_id, parent_id, body, created_at, author_id")
        .eq("post_id", postId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
      "comments fetch"
    ));
    logIfSlow("comments_query", Date.now() - started, requestId);
  } catch (err) {
    console.error("[comments] fetch timeout", err);
    logIfSlow("comments_total", Date.now() - totalStart, requestId);
    return NextResponse.json({ error: "Comments are taking too long to load." }, { status: 504 });
  }

  if (error) {
    console.error("[comments] fetch error", error);
    logIfSlow("comments_total", Date.now() - totalStart, requestId);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }

  const rows = (comments || []) as CommentRow[];
  const authorIds = Array.from(new Set(rows.map((row) => row.author_id)));
  let profileMap = new Map<string, ProfileIdentityRow>();
  try {
    const started = Date.now();
    profileMap = await getProfileMap(authorIds);
    logIfSlow("profile_identity", Date.now() - started, requestId);
  } catch (err) {
    console.error("[comments] profile lookup timeout", err);
  }

  const topLevel = rows.filter((row) => !row.parent_id);
  const repliesByParent = new Map<string, CommentRow[]>();
  rows
    .filter((row) => row.parent_id)
    .forEach((row) => {
      const list = repliesByParent.get(row.parent_id as string) || [];
      list.push(row);
      repliesByParent.set(row.parent_id as string, list);
    });

  const response = topLevel.map((comment) => {
    const replies = (repliesByParent.get(comment.id) || []).sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    return {
      ...mapComment(comment, profileMap),
      replies: replies.map((reply) => mapComment(reply, profileMap)),
    };
  });

  logIfSlow("comments_total", Date.now() - totalStart, requestId);
  return NextResponse.json(
    { postId, count: rows.length, comments: response },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const totalStart = Date.now();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ error: "Post ID required" }, { status: 400 });
  }

  const payload = await req.json().catch(() => ({}));
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  const parentId = typeof payload?.parentId === "string" ? payload.parentId : null;

  if (!body) {
    return NextResponse.json({ error: "Comment body required" }, { status: 400 });
  }
  if (body.length > 1000) {
    return NextResponse.json({ error: "Comment too long" }, { status: 400 });
  }

  if (parentId) {
    let parent: { id: string; post_id: string; parent_id: string | null } | null = null;
    let parentError: { message?: string } | null = null;
    try {
      const started = Date.now();
      ({ data: parent, error: parentError } = await withTimeout(
        supabase
          .from("post_comments")
          .select("id, post_id, parent_id")
          .eq("id", parentId)
          .maybeSingle(),
        "parent lookup"
      ));
      logIfSlow("parent_lookup", Date.now() - started, requestId);
    } catch (err) {
      console.error("[comments] parent lookup timeout", err);
      logIfSlow("comments_total", Date.now() - totalStart, requestId);
      return NextResponse.json({ error: "Comment reply check timed out." }, { status: 504 });
    }
    if (parentError || !parent) {
      return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
    }
    if (parent.post_id !== postId) {
      return NextResponse.json({ error: "Parent comment mismatch" }, { status: 400 });
    }
    if (parent.parent_id) {
      return NextResponse.json({ error: "Replies only allowed on top-level comments" }, { status: 400 });
    }
  }

  let comment: CommentRow | null = null;
  let error: { message?: string } | null = null;
  try {
    const started = Date.now();
    ({ data: comment, error } = await withTimeout(
      supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          parent_id: parentId,
          body,
          author_id: user.id,
        })
        .select("id, post_id, parent_id, body, created_at, author_id")
        .single(),
      "comment insert"
    ));
    logIfSlow("comment_insert", Date.now() - started, requestId);
  } catch (err) {
    console.error("[comments] insert timeout", err);
    logIfSlow("comments_total", Date.now() - totalStart, requestId);
    return NextResponse.json({ error: "Comment save timed out." }, { status: 504 });
  }

  if (error || !comment) {
    console.error("[comments] insert error", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }

  let profileMap = new Map<string, ProfileIdentityRow>();
  try {
    const started = Date.now();
    profileMap = await getProfileMap([comment.author_id]);
    logIfSlow("profile_identity", Date.now() - started, requestId);
  } catch (err) {
    console.error("[comments] profile lookup timeout", err);
  }
  const mapped = mapComment(comment as CommentRow, profileMap);

  logIfSlow("comments_total", Date.now() - totalStart, requestId);
  return NextResponse.json({ comment: { ...mapped, replies: [] } });
}
