import type { User } from "@supabase/supabase-js";
import type { PostAuthorRole, PostAuthorTier } from "@/lib/postPriority";

type ProfileLike = {
  id?: string | null;
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  tier?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  border_style?: string | null;
};

export function getDisplayName(profile?: ProfileLike | null, user?: User | null): string {
  const raw = profile?.display_name?.trim();
  if (raw) return raw;

  const username = profile?.username?.trim();
  if (username) return username;

  const metaName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined);
  if (metaName && metaName.trim()) return metaName.trim();

  const idSource = profile?.id || user?.id || "";
  if (idSource) {
    return `Member ${idSource.slice(0, 6)}`;
  }
  return "Member";
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function normalizeRole(role?: string | null): PostAuthorRole {
  const value = (role || "").toLowerCase();
  if (value === "admin") return "admin";
  if (value === "vendor") return "vendor";
  if (value === "affiliate") return "affiliate";
  if (value === "driver") return "driver";
  return "consumer";
}

export function normalizeTier(tier?: string | null): PostAuthorTier {
  const value = (tier || "").toLowerCase();
  if (value === "vip") return "vip";
  if (value === "enterprise") return "enterprise";
  if (value === "pro") return "pro";
  if (value === "starter") return "starter";
  return "none";
}
