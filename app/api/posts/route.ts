import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isAdminEmail } from "@/lib/admin";
import { isConsumerSubscriptionActive } from "@/lib/consumer-access";
import { getPostPriorityRank, type PostAuthorRole, type PostAuthorTier } from "@/lib/postPriority";

type MediaInput = {
  media_type: "image" | "video";
  media_url: string;
};

const MAX_CONTENT_LENGTH = 2000;
const MAX_MEDIA_ITEMS = 6;
const DEFAULT_LIMIT = 20;

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

const resolveAuthorName = (params: {
  role: PostAuthorRole;
  profileName?: string | null;
  profileEmail?: string | null;
  vendorName?: string | null;
}) => {
  if (params.role === "vendor" && params.vendorName) {
    return params.vendorName;
  }
  return params.profileName || params.profileEmail || "Good Hemp Member";
};

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
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

  let query = supabase
    .from("posts")
    .select(
      "id, author_id, author_role, author_tier, content, is_admin_post, is_pinned, is_featured, priority_rank, created_at, post_media(id, media_type, media_url, created_at)"
    )
    .order("is_pinned", { ascending: false })
    .order("priority_rank", { ascending: true })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursorPayload) {
    const { priorityRank, createdAt, id } = cursorPayload;
    if (typeof priorityRank === "number") {
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

  const { data: posts, error } = await query;

  if (error) {
    console.error("[posts] fetch error", error);
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }

  const hasMore = (posts || []).length > limit;
  const sliced = (posts || []).slice(0, limit);
  const authorIds = Array.from(new Set(sliced.map((post) => post.author_id)));
  const admin = getSupabaseAdminClient();
  const { data: profiles } = authorIds.length
    ? await admin.from("profiles").select("id, display_name, email").in("id", authorIds)
    : { data: [] };
  const { data: vendors } = authorIds.length
    ? await admin
        .from("vendors")
        .select("owner_user_id, business_name, subscription_status")
        .in("owner_user_id", authorIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );
  const vendorMap = new Map(
    (vendors || []).map((vendor) => [vendor.owner_user_id, vendor])
  );

  const postIds = sliced.map((post) => post.id);
  const { data: likes } = postIds.length
    ? await supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds)
    : { data: [] };

  const { data: { user } } = await supabase.auth.getUser();
  const likedSet = new Set(
    (likes || []).filter((like) => like.user_id === user?.id).map((like) => like.post_id)
  );
  const likeCountMap = new Map<string, number>();
  (likes || []).forEach((like) => {
    likeCountMap.set(like.post_id, (likeCountMap.get(like.post_id) || 0) + 1);
  });

  const enriched = sliced.map((post) => {
    const profile = profileMap.get(post.author_id);
    const vendor = vendorMap.get(post.author_id);
    const authorName = resolveAuthorName({
      role: post.author_role as PostAuthorRole,
      profileName: profile?.display_name || null,
      profileEmail: profile?.email || null,
      vendorName: vendor?.business_name || null,
    });
    const media = (post.post_media || []).sort((a, b) =>
      String(a.created_at).localeCompare(String(b.created_at))
    );

    return {
      ...post,
      author_name: authorName,
      priorityRank: post.priority_rank ?? getPostPriorityRank(
        post.author_role as PostAuthorRole,
        post.author_tier as PostAuthorTier
      ),
      likeCount: likeCountMap.get(post.id) || 0,
      viewerHasLiked: likedSet.has(post.id),
      vendor_verified: Boolean(
        vendor?.subscription_status && ["active", "trialing"].includes(vendor.subscription_status)
      ),
      post_media: media,
    };
  });

  const nextCursor =
    hasMore && enriched.length > 0
      ? Buffer.from(
          JSON.stringify({
            createdAt: enriched[enriched.length - 1].created_at,
            id: enriched[enriched.length - 1].id,
            priorityRank: enriched[enriched.length - 1].priorityRank,
          })
        ).toString("base64")
      : null;

  return NextResponse.json({ posts: enriched, nextCursor });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json();
  const contentRaw = typeof payload?.content === "string" ? payload.content : "";
  const content = contentRaw.trim();
  const mediaInput = Array.isArray(payload?.media) ? (payload.media as MediaInput[]) : [];

  if (!content && mediaInput.length === 0) {
    return NextResponse.json({ error: "Post requires text or media" }, { status: 400 });
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "Post is too long" }, { status: 400 });
  }

  if (mediaInput.length > MAX_MEDIA_ITEMS) {
    return NextResponse.json({ error: "Too many media items" }, { status: 400 });
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
    .select("id, role, display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin" || isAdminEmail(user.email || profile?.email);

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, business_name, tier, vendor_plan_id, subscription_status")
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
    console.error("[posts] create error", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
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
      console.error("[posts] media insert error", mediaError);
      return NextResponse.json({ error: "Failed to attach media" }, { status: 500 });
    }
    mediaRecords = insertedMedia || [];
  }

  const authorName = resolveAuthorName({
    role: authorRole,
    profileName: profile?.display_name || null,
    profileEmail: profile?.email || user.email || null,
    vendorName: vendor?.business_name || null,
  });

  return NextResponse.json({
    post: {
      ...post,
      author_name: authorName,
      post_media: mediaRecords,
      priorityRank: priorityRank,
      likeCount: 0,
      viewerHasLiked: false,
      vendor_verified: Boolean(
        vendor?.subscription_status && ["active", "trialing"].includes(vendor.subscription_status)
      ),
    },
    firstPost: (count || 0) === 0,
  });
}
