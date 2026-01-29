import type { PostAuthorRole, PostAuthorTier } from "@/lib/postPriority";

export type BadgeKind = "official" | "tier";

export type BadgeInfo = {
  label: string;
  kind: BadgeKind;
};

export type BadgeContext = {
  role: PostAuthorRole;
  tier: PostAuthorTier;
  isAdminPost?: boolean;
  vendorVerified?: boolean;
};

export function isOfficial(role: PostAuthorRole, isAdminPost?: boolean): boolean {
  return role === "admin" || Boolean(isAdminPost);
}

export function isVerifiedVendor(params: {
  subscriptionStatus?: string | null;
  coaAttested?: boolean | null;
}): boolean {
  const active = Boolean(
    params.subscriptionStatus && ["active", "trialing"].includes(params.subscriptionStatus)
  );
  if (!active) return false;
  if (typeof params.coaAttested === "boolean") {
    return params.coaAttested === true;
  }
  return true;
}

const getVendorBadge = (tier: PostAuthorTier, verified?: boolean): BadgeInfo | null => {
  if (!verified) return null;
  if (tier === "vip") return { label: "VIP Vendor", kind: "tier" };
  if (tier === "enterprise") return { label: "Enterprise Vendor", kind: "tier" };
  if (tier === "pro") return { label: "Pro Vendor", kind: "tier" };
  if (tier === "starter") return { label: "Starter Vendor", kind: "tier" };
  return null;
};

const getConsumerBadge = (tier: PostAuthorTier): BadgeInfo | null => {
  if (tier === "vip") return { label: "VIP Consumer", kind: "tier" };
  if (tier === "starter") return { label: "Starter Consumer", kind: "tier" };
  if (tier === "pro") return { label: "Pro Consumer", kind: "tier" };
  if (tier === "enterprise") return { label: "Enterprise Consumer", kind: "tier" };
  return null;
};

export function getBadgeForContext(context: BadgeContext): BadgeInfo | null {
  if (isOfficial(context.role, context.isAdminPost)) {
    return { label: "Good Hemp Distros — Official", kind: "official" };
  }
  if (context.role === "vendor") {
    return getVendorBadge(context.tier, context.vendorVerified);
  }
  if (context.role === "consumer") {
    return getConsumerBadge(context.tier);
  }
  return null;
}

export function getBadgeModel(params: {
  role: PostAuthorRole;
  tier: PostAuthorTier;
  isOfficial?: boolean;
  isVerifiedVendor?: boolean;
  isAdminPost?: boolean;
}): BadgeInfo | null {
  if (params.isOfficial || isOfficial(params.role, params.isAdminPost)) {
    return { label: "Good Hemp Distros — Official", kind: "official" };
  }
  return getBadgeForContext({
    role: params.role,
    tier: params.tier,
    isAdminPost: params.isAdminPost,
    vendorVerified: params.isVerifiedVendor,
  });
}
