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
  "vendor:enterprise": 3,
  "vendor:pro": 4,
  "vendor:starter": 6,
  "vendor:none": 6,
  "consumer:vip": 5,
  "consumer:enterprise": 7,
  "consumer:pro": 7,
  "consumer:starter": 7,
  "consumer:none": 7,
  "affiliate:vip": 8,
  "affiliate:enterprise": 8,
  "affiliate:pro": 8,
  "affiliate:starter": 8,
  "affiliate:none": 8,
  "driver:vip": 9,
  "driver:enterprise": 9,
  "driver:pro": 9,
  "driver:starter": 9,
  "driver:none": 9,
};

export function getPostPriorityRank(role: PostAuthorRole, tier: PostAuthorTier): number {
  return priorityRank[`${role}:${tier}`] ?? 99;
}

export function getPostBadgeLabel(role: PostAuthorRole, tier: PostAuthorTier, isAdminPost: boolean): string | null {
  if (role === "admin" || isAdminPost) {
    return "Good Hemp Distros • Official";
  }
  if (role === "vendor") {
    if (tier === "vip") return "VIP Vendor";
    if (tier === "enterprise") return "Enterprise Vendor";
    if (tier === "pro") return "Pro Vendor";
    return "Starter Vendor";
  }
  if (role === "consumer") {
    return tier === "vip" ? "VIP Consumer" : "Consumer";
  }
  if (role === "affiliate") {
    return "Affiliate";
  }
  if (role === "driver") {
    return "Driver";
  }
  return null;
}
