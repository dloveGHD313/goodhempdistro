"use client";

import type { BadgeInfo } from "@/lib/badges";

type Props = {
  badge: BadgeInfo | null;
  isVerifiedVendor?: boolean;
};

export default function ProfileBadge({ badge, isVerifiedVendor }: Props) {
  return (
    <div className="profile-badge-row">
      {badge && (
        <span className={badge.kind === "official" ? "badge-official" : "badge-tier"}>
          {badge.label}
        </span>
      )}
      {isVerifiedVendor && <span className="badge-verified">Verified</span>}
    </div>
  );
}
