/**
 * Admin episode manager helpers (brief 2026-07-16 P1) — pure, shared by
 * the /api/admin/jax routes and unit-tested.
 */

import type { JaxEpisodeStatus } from "@/lib/jax/episodes";

export const EDITABLE_EPISODE_FIELDS = [
  "slug",
  "title",
  "summary",
  "description",
  "episode_number",
  "pillar",
  "track",
  "members_only",
  "publish_at",
  "video_url",
  "teaser_video_url",
  "thumbnail_url",
  "duration_seconds",
  "seo_tags",
] as const;

export function pickEpisodeFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const field of EDITABLE_EPISODE_FIELDS) {
    if (field in body) out[field] = body[field];
  }
  return out;
}

/**
 * Allowed status transitions: draft → in_review → approved (CEO) →
 * published, with backward moves permitted for corrections (published →
 * approved to pull a live episode, anything → draft to rework).
 */
export function isAllowedStatusTransition(
  from: JaxEpisodeStatus,
  to: JaxEpisodeStatus
): boolean {
  if (from === to) return true;
  const forward: Record<JaxEpisodeStatus, JaxEpisodeStatus[]> = {
    draft: ["in_review"],
    in_review: ["approved", "draft"],
    approved: ["published", "in_review", "draft"],
    published: ["approved", "draft"],
  };
  return forward[from]?.includes(to) ?? false;
}

export type JaxMediaKind = "video" | "teaser" | "thumbnail";

const MEDIA_MIME: Record<JaxMediaKind, Record<string, string>> = {
  video: { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" },
  teaser: { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" },
  thumbnail: { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" },
};

/** 2GB video cap, 10MB thumbnails. */
export const MEDIA_MAX_BYTES: Record<JaxMediaKind, number> = {
  video: 2 * 1024 * 1024 * 1024,
  teaser: 2 * 1024 * 1024 * 1024,
  thumbnail: 10 * 1024 * 1024,
};

export function validateJaxMedia(
  kind: JaxMediaKind,
  mime: string,
  size: number
): { ok: true; ext: string } | { ok: false; reason: string } {
  const ext = MEDIA_MIME[kind]?.[mime.toLowerCase()];
  if (!ext) {
    return {
      ok: false,
      reason:
        kind === "thumbnail"
          ? "Thumbnail must be PNG, JPG, or WebP."
          : "Video must be MP4, WebM, or MOV.",
    };
  }
  if (size <= 0) return { ok: false, reason: "File is empty." };
  if (size > MEDIA_MAX_BYTES[kind]) {
    return { ok: false, reason: `File is too large (${kind === "thumbnail" ? "10MB" : "2GB"} max).` };
  }
  return { ok: true, ext };
}

/** Storage path inside the jax-media bucket. */
export function jaxMediaPath(episodeId: string, kind: JaxMediaKind, ext: string): string {
  return `episodes/${episodeId}/${kind}.${ext}`;
}
