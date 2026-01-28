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

const resolveVendorTier = async (
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  vendorPlanId: string | null,
  vendorTier: string | null
): Promise<PostAuthorTier> => {
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
  return "none";
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
  const limit = Math.min(Number(searchParams.get("limit") || 30), 100);

  const { data: posts, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, author_role, author_tier, content, is_admin_post, is_pinned, is_featured, created_at, post_media(id, media_type, media_url, created_at)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[posts] fetch error", error);
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }

  const authorIds = Array.from(new Set((posts || []).map((post) => post.author_id)));
  const admin = getSupabaseAdminClient();
  const { data: profiles } = authorIds.length
    ? await admin.from("profiles").select("id, display_name, email").in("id", authorIds)
    : { data: [] };
  const { data: vendors } = authorIds.length
    ? await admin.from("vendors").select("owner_user_id, business_name").in("owner_user_id", authorIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );
  const vendorMap = new Map(
    (vendors || []).map((vendor) => [vendor.owner_user_id, vendor])
  );

  const enriched = (posts || []).map((post) => {
    const profile = profileMap.get(post.author_id);
    const vendor = vendorMap.get(post.author_id);
    const authorName = resolveAuthorName({
      role: post.author_role as PostAuthorRole,
      profileName: profile?.display_name || null,
      profileEmail: profile?.email || null,
      vendorName: vendor?.business_name || null,
    });
    const priorityRank = getPostPriorityRank(
      post.author_role as PostAuthorRole,
      post.author_tier as PostAuthorTier
    );
    const media = (post.post_media || []).sort((a, b) =>
      String(a.created_at).localeCompare(String(b.created_at))
    );

    return {
      ...post,
      author_name: authorName,
      priorityRank,
      post_media: media,
    };
  });

  const sorted = enriched.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    return String(b.created_at).localeCompare(String(a.created_at));
  });

  return NextResponse.json({ posts: sorted });
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
    .select("id, business_name, tier, vendor_plan_id")
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
    authorTier = await resolveVendorTier(supabase, vendor?.vendor_plan_id || null, vendor?.tier || null);
  } else if (authorRole === "consumer") {
    authorTier = isConsumerSubscriptionActive(consumerStatus)
      ? resolveConsumerTier(consumerPlanKey)
      : "none";
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      author_role: authorRole,
      author_tier: authorTier,
      content: content || "",
      is_admin_post: isAdmin,
    })
    .select(
      "id, author_id, author_role, author_tier, content, is_admin_post, is_pinned, is_featured, created_at"
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

  const priorityRank = getPostPriorityRank(authorRole, authorTier);

  return NextResponse.json({
    post: {
      ...post,
      author_name: authorName,
      post_media: mediaRecords,
      priorityRank,
    },
    firstPost: (count || 0) === 0,
  });
}
