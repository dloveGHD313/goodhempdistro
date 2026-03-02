import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { applySupabaseCookies, createSupabaseRouteClient } from "@/lib/supabaseRoute";
import { getDisplayName } from "@/lib/identity";

type ProfileIdentityRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email?: string | null;
};

export async function GET(req: NextRequest) {
  const { supabase: routeSupabase, response } = createSupabaseRouteClient(req);
  const { user, isAdmin } = await requireAdminUsers(req);

  if (!user) {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    applySupabaseCookies(response, res);
    return res;
  }
  if (!isAdmin) {
    const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    applySupabaseCookies(response, res);
    return res;
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "open";
  const reportedOnly = searchParams.get("reportedOnly") === "true";
  const search = searchParams.get("search")?.trim() || "";

  const admin = createSupabaseAdminClient();

  let query = admin
    .from("post_comments")
    .select(
      "id, post_id, parent_id, body, created_at, author_id, is_deleted, is_pinned, is_featured, priority_rank, is_locked, moderation_note"
    )
    .order("created_at", { ascending: false });

  if (status === "deleted") {
    query = query.eq("is_deleted", true);
  } else if (status === "open") {
    query = query.eq("is_deleted", false);
  }

  if (search) {
    query = query.ilike("body", `%${search}%`);
  }

  const { data: comments, error } = await query;

  if (error) {
    console.error("[admin/moderation/comments] fetch error:", error);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }

  const rows = (comments || []) as Array<{
    id: string;
    post_id: string;
    parent_id: string | null;
    body: string;
    created_at: string;
    author_id: string;
    is_deleted: boolean;
    is_pinned: boolean;
    is_featured: boolean;
    priority_rank: number;
    is_locked: boolean;
    moderation_note: string | null;
  }>;

  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const profileMap = new Map<string, ProfileIdentityRow>();
  if (authorIds.length > 0) {
    const { data: identities } = await admin.rpc("get_profiles_identity", {
      author_ids: authorIds,
    });
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", authorIds);
    const emailMap = new Map(
      (profiles || []).map((p: { id: string; email?: string }) => [p.id, p.email ?? null])
    );
    for (const row of (identities || []) as ProfileIdentityRow[]) {
      profileMap.set(row.id, { ...row, email: emailMap.get(row.id) ?? undefined });
    }
  }

  const { data: reportCounts } = await admin
    .from("post_comment_reports")
    .select("comment_id");
  const countByComment = new Map<string, number>();
  for (const r of reportCounts || []) {
    const cid = (r as { comment_id: string }).comment_id;
    countByComment.set(cid, (countByComment.get(cid) || 0) + 1);
  }

  const filteredRows = reportedOnly
    ? rows.filter((r) => (countByComment.get(r.id) || 0) > 0)
    : rows;

  const parentIds = filteredRows.map((r) => r.id);
  const repliesByParent = new Map<string, number>();
  if (parentIds.length > 0) {
    const { data: replyCounts } = await admin
      .from("post_comments")
      .select("parent_id")
      .in("parent_id", parentIds);
    for (const r of replyCounts || []) {
      const pid = (r as { parent_id: string | null }).parent_id;
      if (pid) repliesByParent.set(pid, (repliesByParent.get(pid) || 0) + 1);
    }
  }

  const list = filteredRows.map((c) => {
    const profile = profileMap.get(c.author_id);
    return {
      id: c.id,
      postId: c.post_id,
      parentId: c.parent_id,
      body: c.body,
      createdAt: c.created_at,
      authorId: c.author_id,
      authorDisplayName: getDisplayName(
        { id: profile?.id ?? c.author_id, display_name: profile?.display_name ?? null, username: profile?.username ?? null },
        null
      ),
      authorEmail: profile?.email ?? null,
      isDeleted: c.is_deleted,
      isPinned: c.is_pinned,
      isFeatured: c.is_featured,
      priorityRank: c.priority_rank,
      isLocked: c.is_locked,
      moderationNote: c.moderation_note,
      reportCount: countByComment.get(c.id) || 0,
      replyCount: repliesByParent.get(c.id) || 0,
    };
  });

  return NextResponse.json({ comments: list });
}
