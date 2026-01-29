"use client";

import { getBadgeModel, type BadgeInfo } from "@/lib/badges";
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
  badgeModel?: BadgeInfo | null;
};

export default function ProfileChip({
  displayName,
  avatarUrl,
  role,
  tier,
  isOfficial,
  isVerifiedVendor,
  badgeModel,
}: Props) {
  const badge =
    badgeModel === undefined ? getBadgeModel({ role, tier, isOfficial, isVerifiedVendor }) : badgeModel;
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
