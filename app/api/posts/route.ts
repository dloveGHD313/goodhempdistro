import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isAdminEmail } from "@/lib/admin";
import { isConsumerSubscriptionActive } from "@/lib/consumer-access";
import { getPostPriorityRank, type PostAuthorRole, type PostAuthorTier } from "@/lib/postPriority";
import { getBadgeForContext, isVerifiedVendor } from "@/lib/badges";
import { getDisplayName } from "@/lib/identity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MediaInput = {
  media_type: "image" | "video";
  media_url: string;
};

const MAX_CONTENT_LENGTH = 2000;
const MAX_MEDIA_ITEMS = 6;
const DEFAULT_LIMIT = 20;

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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

const getViewerSupabaseClient = async (_req: NextRequest) => {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

  if (user) {
    return { supabase: authed, viewer: user, mode: "authenticated" as const };
  }

  return { supabase: createAnonServerClient(), viewer: null, mode: "anon" as const };
};

const fetchProfilesByAuthorIds = async (supabase: SupabaseServerClient, authorIds: string[]) => {
  if (authorIds.length === 0) return new Map<string, any>();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, border_style, role, tier")
    .in("id", authorIds);

  if (error) {
    console.error("[posts][GET] profile identity read failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }

  return new Map((profiles || []).map((profile) => [profile.id, profile]));
};

const fetchVendorsByOwnerIds = async (supabase: SupabaseServerClient, authorIds: string[]) => {
  if (authorIds.length === 0) return new Map<string, any>();
  const { data: vendors, error } = await supabase
    .from("vendors")
    .select("owner_user_id, business_name, subscription_status, coa_attested")
    .in("owner_user_id", authorIds);

  if (error) {
    console.error("[posts][GET] vendor read failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }

  return new Map((vendors || []).map((vendor) => [vendor.owner_user_id, vendor]));
};

const resolveVendorTier = async (
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  vendorPlanId: string | null,
  vendorTier: string | null,
  subscriptionStatus: string | null
): Promise<PostAuthorTier> => {
  if (!subscriptionStatus || !["active", "trialing"].includes(subscriptionStatus)) {
    return "none";
  }
  if (vendorPlanId) {
    const { data: plan } = await supabase
      .from("vendor_plans")
      .select("name")
      .eq("id", vendorPlanId)
      .maybeSingle();
    const name = (plan?.name || "").toLowerCase();
    if (name.includes("elite")) return "vip";
    if (name.includes("enterprise")) return "enterprise";
    if (name.includes("pro")) return "pro";
    if (name.includes("basic")) return "starter";
  }

  if (vendorTier === "top") return "enterprise";
  if (vendorTier === "mid") return "pro";
  if (vendorTier === "starter") return "starter";
  return "none";
};

const resolveConsumerTier = (planKey: string | null): PostAuthorTier => {
  if (!planKey) return "none";
  const normalized = planKey.toLowerCase();
  if (normalized.includes("vip") || normalized.includes("premium")) return "vip";
  return "starter";
};

export async function GET(req: NextRequest) {
  const { supabase, viewer } = await getViewerSupabaseClient(req);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || DEFAULT_LIMIT), 50);
  const cursor = searchParams.get("cursor");
  let cursorPayload: { priorityRank?: number; createdAt: string; id: string } | null = null;
  if (cursor) {
    try {
      cursorPayload = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    } catch {
      cursorPayload = null;
    }
  }

  const buildQuery = (includePriority: boolean) => {
    let selectFields =
      "id, author_id, author_role, author_tier, content, is_admin_post, is_pinned, is_featured, created_at, post_media(id, media_type, media_url, created_at)";
    if (includePriority) {
      selectFields =
        "id, author_id, author_role, author_tier, content, is_admin_post, is_pinned, is_featured, priority_rank, created_at, post_media(id, media_type, media_url, created_at)";
    }

    let query = supabase.from("posts").select(selectFields);

    if (includePriority) {
      query = query
        .order("is_pinned", { ascending: false })
        .order("priority_rank", { ascending: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
    }

    query = query.limit(limit + 1);

    if (cursorPayload) {
      const { priorityRank, createdAt, id } = cursorPayload;
      if (includePriority && typeof priorityRank === "number") {
        query = query.or(
          [
            `priority_rank.gt.${priorityRank}`,
            `and(priority_rank.eq.${priorityRank},created_at.lt.${createdAt})`,
            `and(priority_rank.eq.${priorityRank},created_at.eq.${createdAt},id.lt.${id})`,
          ].join(",")
        );
      } else {
        query = query.or(
          [`created_at.lt.${createdAt}`, `and(created_at.eq.${createdAt},id.lt.${id})`].join(",")
        );
      }
    }

    return query;
  };

  let posts: Array<any> | null = null;
  let error: { message?: string } | null = null;
  let includePriority = true;
  ({ data: posts, error } = await buildQuery(true));

  if (error && String(error.message || "").includes("priority_rank")) {
    includePriority = false;
    ({ data: posts, error } = await buildQuery(false));
  }

  if (error) {
    console.error("[posts] fetch error", error);
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }

  const hasMore = (posts || []).length > limit;
  const sliced = (posts || []).slice(0, limit);
  const authorIds = Array.from(new Set(sliced.map((post) => post.author_id)));
  const [profileMap, vendorMap] = await Promise.all([
    fetchProfilesByAuthorIds(supabase, authorIds),
    fetchVendorsByOwnerIds(supabase, authorIds),
  ]);

  const postIds = sliced.map((post) => post.id);
  const { data: likes } = postIds.length
    ? await supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds)
    : { data: [] };

  const likedSet = new Set(
    (likes || []).filter((like) => like.user_id === viewer?.id).map((like) => like.post_id)
  );
  const likeCountMap = new Map<string, number>();
  (likes || []).forEach((like) => {
    likeCountMap.set(like.post_id, (likeCountMap.get(like.post_id) || 0) + 1);
  });

  const enriched = sliced.map((post) => {
    const profile = profileMap.get(post.author_id);
    const vendor = vendorMap.get(post.author_id);
    const displayName = getDisplayName(
      {
        id: profile?.id ?? post.author_id,
        display_name: profile?.display_name,
        username: (profile as { username?: string | null })?.username || null,
      },
      null
    );
    const media = (post.post_media || []) as Array<{ created_at?: string | null }>;
    media.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));

    return {
      ...post,
      authorDisplayName: displayName,
      authorAvatarUrl: profile?.avatar_url || null,
      authorBadgeModel: getBadgeForContext({
        role: post.author_role as PostAuthorRole,
        tier: post.author_tier as PostAuthorTier,
        isAdminPost: post.is_admin_post,
        vendorVerified: isVerifiedVendor({
          subscriptionStatus: vendor?.subscription_status || null,
          coaAttested: typeof vendor?.coa_attested === "boolean" ? vendor?.coa_attested : null,
        }),
      }),
      priorityRank: post.priority_rank ?? getPostPriorityRank(
        post.author_role as PostAuthorRole,
        post.author_tier as PostAuthorTier
      ),
      likeCount: likeCountMap.get(post.id) || 0,
      viewerHasLiked: likedSet.has(post.id),
      vendor_verified: isVerifiedVendor({
        subscriptionStatus: vendor?.subscription_status || null,
        coaAttested: typeof vendor?.coa_attested === "boolean" ? vendor?.coa_attested : null,
      }),
      post_media: media,
    };
  });

  const nextCursor =
    hasMore && enriched.length > 0
      ? Buffer.from(
          JSON.stringify({
            createdAt: enriched[enriched.length - 1].created_at,
            id: enriched[enriched.length - 1].id,
            ...(includePriority ? { priorityRank: enriched[enriched.length - 1].priorityRank } : {}),
          })
        ).toString("base64")
      : null;

  return NextResponse.json(
    { posts: enriched, nextCursor },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "Unauthorized" },
      { status: 401 }
    );
  }

  const payload = await req.json();
  const contentRaw = typeof payload?.content === "string" ? payload.content : "";
  const content = contentRaw.trim();
  const mediaInput = Array.isArray(payload?.media) ? (payload.media as MediaInput[]) : [];

  if (!content && mediaInput.length === 0) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", message: "Post requires text or media" },
      { status: 400 }
    );
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", message: "Post is too long" },
      { status: 400 }
    );
  }

  if (mediaInput.length > MAX_MEDIA_ITEMS) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", message: "Too many media items" },
      { status: 400 }
    );
  }

  const sanitizedMedia = mediaInput.filter(
    (item) =>
      item &&
      (item.media_type === "image" || item.media_type === "video") &&
      typeof item.media_url === "string" &&
      item.media_url.length > 0
  );

  const { count } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name, username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin" || isAdminEmail(user.email);

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, business_name, tier, vendor_plan_id, subscription_status, coa_attested")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  let consumerPlanKey: string | null = null;
  let consumerStatus: string | null = null;
  const consumerResponse = await supabase
    .from("consumer_subscriptions")
    .select("subscription_status, consumer_plan_key")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!consumerResponse.error && consumerResponse.data) {
    consumerStatus = consumerResponse.data.subscription_status || null;
    consumerPlanKey = consumerResponse.data.consumer_plan_key || null;
  } else {
    const admin = getSupabaseAdminClient();
    const { data: adminData } = await admin
      .from("consumer_subscriptions")
      .select("subscription_status, consumer_plan_key")
      .eq("user_id", user.id)
      .maybeSingle();
    consumerStatus = adminData?.subscription_status || null;
    consumerPlanKey = adminData?.consumer_plan_key || null;
  }

  let authorRole: PostAuthorRole = "consumer";
  if (isAdmin) authorRole = "admin";
  else if (vendor?.id) authorRole = "vendor";
  else if (affiliate?.id) authorRole = "affiliate";
  else if (driver?.id) authorRole = "driver";

  let authorTier: PostAuthorTier = "none";
  if (authorRole === "vendor") {
    authorTier = await resolveVendorTier(
      supabase,
      vendor?.vendor_plan_id || null,
      vendor?.tier || null,
      vendor?.subscription_status || null
    );
  } else if (authorRole === "consumer") {
    authorTier = isConsumerSubscriptionActive(consumerStatus)
      ? resolveConsumerTier(consumerPlanKey)
      : "none";
  }

  const priorityRank = getPostPriorityRank(authorRole, authorTier);

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      author_role: authorRole,
      author_tier: authorTier,
      content: content || "",
      is_admin_post: isAdmin,
      priority_rank: priorityRank,
    })
    .select(
      "id, author_id, author_role, author_tier, content, is_admin_post, is_pinned, is_featured, priority_rank, created_at"
    )
    .single();

  if (error || !post) {
    console.error("[POST_CREATE] insert error", error);
    return NextResponse.json(
      {
        ok: false,
        code: "SUPABASE_INSERT_FAILED",
        message: error?.message || "Failed to create post",
        details: error?.details || null,
      },
      { status: 500 }
    );
  }

  let mediaRecords: Array<{ id: string; media_type: string; media_url: string; created_at: string }> = [];
  if (sanitizedMedia.length > 0) {
    const { data: insertedMedia, error: mediaError } = await supabase
      .from("post_media")
      .insert(
        sanitizedMedia.map((item) => ({
          post_id: post.id,
          media_type: item.media_type,
          media_url: item.media_url,
        }))
      )
      .select("id, media_type, media_url, created_at");
    if (mediaError) {
      console.error("[POST_CREATE] media insert error", mediaError);
      return NextResponse.json(
        {
          ok: false,
          code: "SUPABASE_MEDIA_INSERT_FAILED",
          message: mediaError?.message || "Failed to attach media",
          details: mediaError?.details || null,
        },
        { status: 500 }
      );
    }
    mediaRecords = insertedMedia || [];
  }

  const authorName = getDisplayName(
    {
      id: profile?.id,
      display_name: profile?.display_name,
      username: (profile as { username?: string | null })?.username || null,
    },
    user
  );

  return NextResponse.json({
    post: {
      ...post,
      authorDisplayName: authorName,
      authorAvatarUrl: profile?.avatar_url || null,
      authorBadgeModel: getBadgeForContext({
        role: authorRole,
        tier: authorTier,
        isAdminPost: isAdmin,
        vendorVerified: isVerifiedVendor({
          subscriptionStatus: vendor?.subscription_status || null,
          coaAttested: typeof vendor?.coa_attested === "boolean" ? vendor?.coa_attested : null,
        }),
      }),
      post_media: mediaRecords,
      priorityRank: priorityRank,
      likeCount: 0,
      viewerHasLiked: false,
      vendor_verified: isVerifiedVendor({
        subscriptionStatus: vendor?.subscription_status || null,
        coaAttested: typeof vendor?.coa_attested === "boolean" ? vendor?.coa_attested : null,
      }),
    },
    firstPost: (count || 0) === 0,
  });
}
