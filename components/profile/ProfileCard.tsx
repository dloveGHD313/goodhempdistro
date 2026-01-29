"use client";

import { getBadgeModel } from "@/lib/badges";
import { getInitials } from "@/lib/identity";
import type { PostAuthorRole, PostAuthorTier } from "@/lib/postPriority";
import ProfileBadge from "./ProfileBadge";

type Props = {
  displayName: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  role: PostAuthorRole;
  tier: PostAuthorTier;
  isOfficial?: boolean;
  isVerifiedVendor?: boolean;
  secondary?: string | null;
  compact?: boolean;
  placeholderText?: string;
};

export default function ProfileCard({
  displayName,
  avatarUrl,
  bannerUrl,
  role,
  tier,
  isOfficial,
  isVerifiedVendor,
  secondary,
  compact,
  placeholderText,
}: Props) {
  const badge = getBadgeModel({ role, tier, isOfficial, isVerifiedVendor });
  return (
    <div className={`profile-card ${compact ? "profile-card--compact" : ""}`}>
      {bannerUrl ? (
        <div className="profile-card-banner">
          <img src={bannerUrl} alt={`${displayName} banner`} />
        </div>
      ) : (
        <div className="profile-card-banner profile-card-banner--placeholder" />
      )}
      <div className="profile-card-body">
        <div className="profile-card-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${displayName} avatar`} />
          ) : (
            <span>{getInitials(displayName)}</span>
          )}
        </div>
        <div className="profile-card-text">
          <div className="profile-card-name">{displayName}</div>
          <ProfileBadge badge={badge} isVerifiedVendor={isVerifiedVendor} />
          {secondary && <div className="profile-card-secondary">{secondary}</div>}
          {placeholderText && <div className="profile-card-placeholder">{placeholderText}</div>}
        </div>
      </div>
    </div>
  );
}
