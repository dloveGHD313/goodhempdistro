/**
 * Learning with JAX episode access + publishing model.
 *
 * Publishing automation (brief 2026-07-16 P1): an episode is publicly
 * released when status='published' OR (status='approved' AND
 * publish_at <= now) — approval plus a scheduled time auto-publishes with
 * no human at the switch. Tier early-access windows (#209: Basic 24h /
 * Plus 72h / Premium 168h before the public time, from the entitlements
 * SSOT) apply on top. members_only episodes stay Premium-only.
 *
 * Teaser rule: teaser_video_url is PUBLIC as soon as the episode is
 * listable to anyone (i.e., the widest early-access window has opened) —
 * it's the marketing preview. The full video respects tier gating.
 *
 * publish_at is the canonical scheduled public time; published_at (from
 * #209) is honored as a fallback for legacy rows.
 */

import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { TIER_ENTITLEMENTS, type ConsumerTier } from "@/lib/entitlements";
import { resolveConsumerTier } from "@/lib/server/consumerTier";

export const JAX_MEDIA_BUCKET = "jax-media";

export type JaxEpisodeStatus = "draft" | "in_review" | "approved" | "published";
export type JaxPillar = "business" | "basics" | "webisodes" | "deep_dives";

export type JaxEpisode = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  video_url: string | null;
  teaser_video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  episode_number: number | null;
  pillar: JaxPillar;
  track: string | null;
  status: JaxEpisodeStatus;
  publish_at: string | null;
  published_at: string | null;
  members_only: boolean;
  seo_tags: string[] | null;
};

type VisibilityInput = Pick<
  JaxEpisode,
  "status" | "publish_at" | "published_at" | "members_only"
>;

/** Canonical scheduled public time: publish_at, legacy published_at fallback. */
export function episodePublicAt(
  episode: Pick<JaxEpisode, "publish_at" | "published_at">
): Date | null {
  const value = episode.publish_at ?? episode.published_at;
  return value ? new Date(value) : null;
}

/**
 * Can this tier watch the FULL episode right now? Pure — unit-tested.
 * - draft / in_review: never.
 * - published: live immediately (members_only still Premium-only).
 * - approved: live from publicAt − tierEarlyAccessHours (auto-publish).
 */
export function isEpisodeLiveForTier(
  episode: VisibilityInput,
  tier: ConsumerTier,
  now: Date = new Date()
): boolean {
  const perks = TIER_ENTITLEMENTS[tier];
  if (episode.members_only && !perks.jaxMembersOnly) return false;
  if (episode.status === "published") return true;
  if (episode.status !== "approved") return false;
  const publicAt = episodePublicAt(episode);
  if (!publicAt) return false; // approved with no schedule: not live yet
  const unlockAt = publicAt.getTime() - perks.jaxEarlyAccessHours * 60 * 60 * 1000;
  return now.getTime() >= unlockAt;
}

/**
 * Is the episode LISTABLE at all (teaser + locked card for tiers that
 * can't watch yet)? True once the widest early-access window (Premium)
 * has opened. members_only episodes are never listed to non-Premium.
 */
export function isEpisodeListable(
  episode: VisibilityInput,
  viewerTier: ConsumerTier,
  now: Date = new Date()
): boolean {
  if (episode.members_only && !TIER_ENTITLEMENTS[viewerTier].jaxMembersOnly) {
    return false;
  }
  return isEpisodeLiveForTier({ ...episode, members_only: false }, "Premium", now);
}

/** When the full episode unlocks for a tier (countdown UI). */
export function episodeAvailableAtForTier(
  episode: Pick<JaxEpisode, "publish_at" | "published_at">,
  tier: ConsumerTier
): Date | null {
  const publicAt = episodePublicAt(episode);
  if (!publicAt) return null;
  return new Date(
    publicAt.getTime() - TIER_ENTITLEMENTS[tier].jaxEarlyAccessHours * 60 * 60 * 1000
  );
}

export type ViewerEpisode = JaxEpisode & {
  /** Viewer can watch the full video now. */
  canWatchFull: boolean;
  /** Listed during someone else's early window — show teaser + upsell. */
  teaserOnly: boolean;
};

const EPISODE_SELECT =
  "id, slug, title, summary, description, video_url, teaser_video_url, thumbnail_url, duration_seconds, episode_number, pillar, track, status, publish_at, published_at, members_only, seo_tags";

/**
 * Episodes listable to a viewer (guests = Free), annotated with watch
 * rights. Reads with the service role — jax_episodes has no anon RLS
 * policies by design; this function IS the gate.
 */
export async function getEpisodesForViewer(
  userId: string | null
): Promise<{ tier: ConsumerTier; episodes: ViewerEpisode[] }> {
  const tier = userId ? await resolveConsumerTier(userId) : "Free";
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("jax_episodes")
    .select(EPISODE_SELECT)
    .in("status", ["approved", "published"])
    .order("publish_at", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("[jax-episodes] query failed:", error.message);
    return { tier, episodes: [] };
  }
  const now = new Date();
  const episodes = ((data || []) as JaxEpisode[])
    .filter((ep) => isEpisodeListable(ep, tier, now))
    .map((ep) => {
      const canWatchFull = isEpisodeLiveForTier(ep, tier, now);
      return { ...ep, canWatchFull, teaserOnly: !canWatchFull };
    });
  return { tier, episodes };
}

export async function getEpisodeBySlugForViewer(
  slug: string,
  userId: string | null
): Promise<{ tier: ConsumerTier; episode: ViewerEpisode | null }> {
  const tier = userId ? await resolveConsumerTier(userId) : "Free";
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("jax_episodes")
    .select(EPISODE_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[jax-episodes] slug query failed:", error.message);
    return { tier, episode: null };
  }
  const ep = data as JaxEpisode;
  const now = new Date();
  if (!isEpisodeListable(ep, tier, now)) return { tier, episode: null };
  const canWatchFull = isEpisodeLiveForTier(ep, tier, now);
  return { tier, episode: { ...ep, canWatchFull, teaserOnly: !canWatchFull } };
}

/**
 * Resolve a stored media value to a playable URL. Values are either full
 * http(s) URLs (external hosting) or storage paths inside the private
 * jax-media bucket, which get a 1-hour signed URL.
 */
export async function resolveMediaUrl(value: string | null): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(JAX_MEDIA_BUCKET)
    .createSignedUrl(value, 3600);
  if (error) {
    console.error("[jax-episodes] signed media URL failed:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
