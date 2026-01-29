"use client";

import { getBadgeModel } from "@/lib/badges";
import { getInitials } from "@/lib/identity";
import type { PostAuthorRole, PostAuthorTier } from "@/lib/postPriority";
import ProfileBadge from "./ProfileBadge";

type Props = {
  displayName: string;
  avatarUrl?: string | null;
  role: PostAuthorRole;
  tier: PostAuthorTier;
  isOfficial?: boolean;
  isVerifiedVendor?: boolean;
};

export default function ProfileChip({
  displayName,
  avatarUrl,
  role,
  tier,
  isOfficial,
  isVerifiedVendor,
}: Props) {
  const badge = getBadgeModel({ role, tier, isOfficial, isVerifiedVendor });
  return (
    <div className="profile-chip">
      <div className="profile-chip-avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt={`${displayName} avatar`} />
        ) : (
          <span>{getInitials(displayName)}</span>
        )}
      </div>
      <div className="profile-chip-text">
        <div className="profile-chip-name">{displayName}</div>
        <ProfileBadge badge={badge} isVerifiedVendor={isVerifiedVendor} />
      </div>
    </div>
  );
}
