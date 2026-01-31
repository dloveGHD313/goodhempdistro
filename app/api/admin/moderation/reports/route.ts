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
  const { response } = createSupabaseRouteClient(req);
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

  const admin = createSupabaseAdminClient();

  const { data: reports, error } = await admin
    .from("post_comment_reports")
    .select("id, comment_id, reporter_id, reason, details, created_at, status")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/moderation/reports] fetch error:", error);
    return NextResponse.json({ error: "Failed to load reports" }, { status: 500 });
  }

  const rows = (reports || []) as Array<{
    id: string;
    comment_id: string;
    reporter_id: string | null;
    reason: string;
    details: string | null;
    created_at: string;
    status: string;
  }>;

  const commentIds = [...new Set(rows.map((r) => r.comment_id))];
  const reporterIds = [...new Set(rows.map((r) => r.reporter_id).filter(Boolean))] as string[];

  const { data: comments } = await admin
    .from("post_comments")
    .select("id, post_id, parent_id, body, created_at, author_id, is_deleted")
    .in("id", commentIds);
  const commentMap = new Map<string, { id: string; post_id: string; parent_id: string | null; body: string; created_at: string; author_id: string; is_deleted: boolean }>();
  for (const c of comments || []) {
    const row = c as { id: string; post_id: string; parent_id: string | null; body: string; created_at: string; author_id: string; is_deleted: boolean };
    commentMap.set(row.id, row);
  }

  const authorIds = [...new Set((comments || []).map((c: { author_id: string }) => c.author_id))];
  const allIds = [...new Set([...authorIds, ...reporterIds])];
  let profileMap = new Map<string, ProfileIdentityRow>();
  if (allIds.length > 0) {
    const { data: identities } = await admin.rpc("get_profiles_identity", {
      author_ids: allIds,
    });
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", allIds);
    const emailMap = new Map(
      (profiles || []).map((p: { id: string; email?: string }) => [p.id, p.email ?? null])
    );
    for (const row of (identities || []) as ProfileIdentityRow[]) {
      profileMap.set(row.id, { ...row, email: emailMap.get(row.id) ?? undefined });
    }
  }

  const list = rows.map((r) => {
    const comment = commentMap.get(r.comment_id) as {
      id: string;
      post_id: string;
      parent_id: string | null;
      body: string;
      created_at: string;
      author_id: string;
      is_deleted: boolean;
    } | undefined;
    const authorProfile = comment ? profileMap.get(comment.author_id) : null;
    const reporterProfile = r.reporter_id ? profileMap.get(r.reporter_id) : null;

    return {
      id: r.id,
      commentId: r.comment_id,
      reporterId: r.reporter_id,
      reason: r.reason,
      details: r.details,
      createdAt: r.created_at,
      status: r.status,
      comment: comment
        ? {
            id: comment.id,
            postId: comment.post_id,
            parentId: comment.parent_id,
            body: comment.body,
            createdAt: comment.created_at,
            authorId: comment.author_id,
            authorDisplayName: getDisplayName(
              {
                id: authorProfile?.id ?? comment.author_id,
                display_name: authorProfile?.display_name ?? null,
                username: authorProfile?.username ?? null,
              },
              null
            ),
            authorEmail: authorProfile?.email ?? null,
            isDeleted: comment.is_deleted,
          }
        : null,
      reporterDisplayName: r.reporter_id
        ? getDisplayName(
            {
              id: reporterProfile?.id ?? r.reporter_id,
              display_name: reporterProfile?.display_name ?? null,
              username: reporterProfile?.username ?? null,
            },
            null
          )
        : null,
      reporterEmail: reporterProfile?.email ?? null,
    };
  });

  return NextResponse.json({ reports: list });
}
