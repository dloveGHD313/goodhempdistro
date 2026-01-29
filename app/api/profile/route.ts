import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getBadgeForContext, isOfficial, isVerifiedVendor } from "@/lib/badges";
import { getDisplayName, normalizeRole } from "@/lib/identity";
import { getPostPriorityRank, type PostAuthorRole, type PostAuthorTier } from "@/lib/postPriority";

type ProfileUpdate = {
  display_name?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  border_style?: string | null;
};

const resolveConsumerTier = (planKey: string | null): PostAuthorTier => {
  if (!planKey) return "none";
  const normalized = planKey.toLowerCase();
  if (normalized.includes("vip") || normalized.includes("premium")) return "vip";
  return "starter";
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, display_name, avatar_url, banner_url, border_style")
    .eq("id", user.id)
    .maybeSingle();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, tier, subscription_status, coa_attested")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const { data: consumer } = await supabase
    .from("consumer_subscriptions")
    .select("subscription_status, consumer_plan_key")
    .eq("user_id", user.id)
    .maybeSingle();

  let role: PostAuthorRole = normalizeRole(profile?.role || (vendor?.id ? "vendor" : "consumer"));

  let tier: PostAuthorTier = "none";
  if (role === "vendor" && vendor?.subscription_status && ["active", "trialing"].includes(vendor.subscription_status)) {
    if (vendor?.tier === "top") tier = "enterprise";
    else if (vendor?.tier === "mid") tier = "pro";
    else if (vendor?.tier === "starter") tier = "starter";
  }
  if (
    role === "consumer" &&
    consumer?.subscription_status &&
    ["active", "trialing"].includes(consumer.subscription_status)
  ) {
    tier = resolveConsumerTier(consumer.consumer_plan_key || null);
  }

  const verifiedVendor = isVerifiedVendor({
    subscriptionStatus: vendor?.subscription_status || null,
    coaAttested: typeof vendor?.coa_attested === "boolean" ? vendor?.coa_attested : null,
  });

  const badge = getBadgeForContext({
    role,
    tier,
    isAdminPost: role === "admin",
    vendorVerified: verifiedVendor,
  });

  const displayName = getDisplayName(profile, user);

  return NextResponse.json({
    ok: true,
    profile: {
      id: profile?.id || user.id,
      email: profile?.email || user.email,
      display_name: displayName,
      role,
      tier,
      avatar_url: profile?.avatar_url || null,
      banner_url: profile?.banner_url || null,
      border_style: profile?.border_style || null,
      badge,
      is_official: isOfficial(role, role === "admin"),
      is_verified_vendor: verifiedVendor,
      priority_rank: getPostPriorityRank(role, tier),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => ({}))) as ProfileUpdate;
  const updates: ProfileUpdate = {};

  if ("display_name" in payload) updates.display_name = payload.display_name ?? null;
  if ("avatar_url" in payload) updates.avatar_url = payload.avatar_url ?? null;
  if ("banner_url" in payload) updates.banner_url = payload.banner_url ?? null;
  if ("border_style" in payload) updates.border_style = payload.border_style ?? null;

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("id, avatar_url, banner_url, border_style")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, code: "PROFILE_UPDATE_FAILED", message: error.message, details: error.details || null },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, profile: data });
}
