import type { BadgeInfo } from "@/lib/badges";
import type { PostAuthorRole, PostAuthorTier } from "@/lib/postPriority";

export type PostMediaDTO = {
  id: string;
  media_type: "image" | "video";
  media_url: string;
  created_at?: string | null;
};

export type PostDTO = {
  id: string;
  author_id: string;
  authorDisplayName?: string | null;
  authorAvatarUrl?: string | null;
  authorBadgeModel?: BadgeInfo | null;
  author_role: PostAuthorRole;
  author_tier: PostAuthorTier;
  content: string;
  is_admin_post: boolean;
  created_at: string;
  post_media: PostMediaDTO[];
  priorityRank: number;
  likeCount: number;
  viewerHasLiked: boolean;
  commentCount?: number;
  vendor_verified?: boolean;
};
