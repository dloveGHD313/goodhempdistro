export type PostAuthorRole = "admin" | "vendor" | "consumer" | "affiliate" | "driver";
export type PostAuthorTier = "vip" | "enterprise" | "pro" | "starter" | "none";

type PriorityKey = `${PostAuthorRole}:${PostAuthorTier}`;

const priorityRank: Record<PriorityKey, number> = {
  "admin:vip": 1,
  "admin:enterprise": 1,
  "admin:pro": 1,
  "admin:starter": 1,
  "admin:none": 1,
  "vendor:vip": 2,
  "vendor:enterprise": 2,
  "vendor:pro": 4,
  "vendor:starter": 4,
  "vendor:none": 5,
  "consumer:vip": 3,
  "consumer:enterprise": 3,
  "consumer:pro": 3,
  "consumer:starter": 3,
  "consumer:none": 5,
  "affiliate:vip": 6,
  "affiliate:enterprise": 6,
  "affiliate:pro": 6,
  "affiliate:starter": 6,
  "affiliate:none": 6,
  "driver:vip": 7,
  "driver:enterprise": 7,
  "driver:pro": 7,
  "driver:starter": 7,
  "driver:none": 7,
};

export function getPostPriorityRank(role: PostAuthorRole, tier: PostAuthorTier): number {
  return priorityRank[`${role}:${tier}`] ?? 99;
}

export function getPostBadgeLabel(role: PostAuthorRole, tier: PostAuthorTier, isAdminPost: boolean): string | null {
  if (role === "admin" || isAdminPost) {
    return "Good Hemp Distros Official";
  }
  if (role === "vendor") {
    if (tier === "vip" || tier === "enterprise") return "Enterprise Vendor";
    if (tier === "pro") return "Pro Vendor";
    return null;
  }
  if (role === "consumer") {
    return tier === "vip" ? "VIP Consumer" : null;
  }
  if (role === "affiliate") {
    return "Affiliate";
  }
  if (role === "driver") {
    return "Driver";
  }
  return null;
}
