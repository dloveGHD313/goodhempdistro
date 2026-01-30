import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getDisplayName } from "@/lib/identity";

type ProfileIdentityRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  border_style: string | null;
  role: string | null;
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

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: flags, error } = await supabase
    .from("post_flags")
    .select(
      "id, post_id, flagged_by, reason, created_at, status, posts(id, author_id, content, created_at, is_deleted)"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[moderation] fetch flags error", error);
    return NextResponse.json({ error: "Failed to load flags" }, { status: 500 });
  }

  const posts = (flags || []).flatMap((flag) => {
    const value = flag.posts as
      | {
          id: string;
          author_id: string;
          content: string;
          created_at: string;
          is_deleted?: boolean | null;
        }
      | Array<{
          id: string;
          author_id: string;
          content: string;
          created_at: string;
          is_deleted?: boolean | null;
        }>
      | null
      | undefined;
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  });
  const authorIds = Array.from(new Set(posts.map((post) => post.author_id)));
  const anon = createAnonServerClient();
  const { data: identities } = authorIds.length
    ? await anon.rpc("get_profiles_identity", { author_ids: authorIds })
    : { data: [] };
  const profileMap = new Map(
    ((identities || []) as ProfileIdentityRow[]).map((row) => [row.id, row])
  );

  const response = (flags || []).map((flag) => {
    const postValue = flag.posts as typeof posts[number] | typeof posts | null;
    const post = Array.isArray(postValue) ? postValue[0] : postValue;
    const profile = post ? profileMap.get(post.author_id) : null;
    return {
      id: flag.id,
      post_id: flag.post_id,
      flagged_by: flag.flagged_by,
      reason: flag.reason,
      created_at: flag.created_at,
      status: flag.status,
      post: post
        ? {
            id: post.id,
            author_id: post.author_id,
            content: post.content,
            created_at: post.created_at,
            is_deleted: Boolean(post.is_deleted),
            authorDisplayName: getDisplayName(
              {
                id: profile?.id ?? post.author_id,
                display_name: profile?.display_name ?? null,
                username: profile?.username ?? null,
              },
              null
            ),
            authorAvatarUrl: profile?.avatar_url ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({ flags: response });
}

export async function PATCH(req: NextRequest) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await req.json().catch(() => ({}));
  const action = payload?.action as string | undefined;
  const flagId = payload?.flagId as string | undefined;

  if (!flagId || !action) {
    return NextResponse.json({ error: "Missing action or flagId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  if (action === "dismiss" || action === "actioned") {
    const { error } = await supabase
      .from("post_flags")
      .update({ status: action })
      .eq("id", flagId);
    if (error) {
      console.error("[moderation] update flag error", error);
      return NextResponse.json({ error: "Failed to update flag" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_post") {
    const { data: flag, error: flagError } = await supabase
      .from("post_flags")
      .select("post_id")
      .eq("id", flagId)
      .maybeSingle();
    if (flagError || !flag?.post_id) {
      return NextResponse.json({ error: "Flag not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("posts")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", flag.post_id);
    if (deleteError) {
      console.error("[moderation] delete post error", deleteError);
      return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
    }

    const { error: flagUpdateError } = await supabase
      .from("post_flags")
      .update({ status: "actioned" })
      .eq("post_id", flag.post_id);
    if (flagUpdateError) {
      console.error("[moderation] update flags error", flagUpdateError);
      return NextResponse.json({ error: "Failed to update flags" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
