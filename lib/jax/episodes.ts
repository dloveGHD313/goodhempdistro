/**
 * Learning with JAX episode access (perks spec 2026-07-10 §6).
 *
 * published_at is the PUBLIC release time. A paid tier sees an episode
 * jaxEarlyAccessHours before that (Basic 24h, Plus 72h, Premium 168h —
 * from the entitlements SSOT, computed at read time so CEO tuning needs
 * no backfill). members_only episodes are visible only to tiers with
 * jaxMembersOnly (Premium). Premium's "full archive" is the whole list —
 * lower tiers also see all their released episodes in v1; the distinction
 * becomes meaningful if a retention window for free viewers is added.
 */

import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { TIER_ENTITLEMENTS, type ConsumerTier } from "@/lib/entitlements";
import { resolveConsumerTier } from "@/lib/server/consumerTier";

export type JaxEpisode = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  video_url: string | null;
  episode_number: number | null;
  published_at: string;
  members_only: boolean;
};

/** Pure gate — unit-tested. */
export function isEpisodeVisibleToTier(
  episode: Pick<JaxEpisode, "published_at" | "members_only">,
  tier: ConsumerTier,
  now: Date = new Date()
): boolean {
  const perks = TIER_ENTITLEMENTS[tier];
  if (episode.members_only && !perks.jaxMembersOnly) return false;
  const availableAt =
    new Date(episode.published_at).getTime() -
    perks.jaxEarlyAccessHours * 60 * 60 * 1000;
  return now.getTime() >= availableAt;
}

/** When the episode unlocks for a tier (for "unlocks in Xh" UI). */
export function episodeAvailableAtForTier(
  episode: Pick<JaxEpisode, "published_at">,
  tier: ConsumerTier
): Date {
  return new Date(
    new Date(episode.published_at).getTime() -
      TIER_ENTITLEMENTS[tier].jaxEarlyAccessHours * 60 * 60 * 1000
  );
}

/**
 * Episodes visible to a user (or a guest when userId is null). Reads with
 * the service role — jax_episodes has no anon RLS policies by design; this
 * function IS the gate.
 */
export async function getVisibleEpisodes(
  userId: string | null
): Promise<{ tier: ConsumerTier; episodes: JaxEpisode[] }> {
  const tier = userId ? await resolveConsumerTier(userId) : "Free";
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("jax_episodes")
    .select(
      "id, slug, title, summary, video_url, episode_number, published_at, members_only"
    )
    .order("published_at", { ascending: false });
  if (error) {
    console.error("[jax-episodes] query failed:", error.message);
    return { tier, episodes: [] };
  }
  const now = new Date();
  const episodes = ((data || []) as JaxEpisode[]).filter((ep) =>
    isEpisodeVisibleToTier(ep, tier, now)
  );
  return { tier, episodes };
}
