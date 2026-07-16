import { Metadata } from "next";
import { brand } from "@/lib/brand";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getEpisodesForViewer, resolveMediaUrl } from "@/lib/jax/episodes";
import LearningWithJaxMotion, { type FeaturedEpisode } from "./LearningWithJaxMotion";

export const metadata: Metadata = {
  title: "Learning with Jax | Hemp Industry Education",
  description:
    "Educational episodes on hemp compliance, vendor growth strategies, and industry knowledge — from the Good Hemp Distro platform.",
  openGraph: {
    title: "Learning with Jax | Hemp Industry Education",
    description:
      "Educational episodes on hemp compliance, vendor growth strategies, and industry knowledge — from the Good Hemp Distro platform.",
    url: `${brand.url}/learning-with-jax`,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Learning with Jax | Hemp Industry Education",
    description:
      "Educational episodes on hemp compliance, vendor growth strategies, and industry knowledge — from the Good Hemp Distro platform.",
  },
};

export const dynamic = "force-dynamic";

/**
 * Live hub (brief 2026-07-16 P1 §4): pillar/track counts and the featured
 * episode come from jax_episodes; "coming soon" only shows where a pillar
 * genuinely has zero visible episodes.
 */
export default async function LearningWithJaxPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { episodes } = await getEpisodesForViewer(user?.id ?? null);

  const pillarCounts: Record<string, number> = {};
  const trackCounts: Record<string, number> = {};
  for (const ep of episodes) {
    pillarCounts[ep.pillar] = (pillarCounts[ep.pillar] ?? 0) + 1;
    if (ep.track) trackCounts[ep.track] = (trackCounts[ep.track] ?? 0) + 1;
  }

  let featured: FeaturedEpisode | null = null;
  if (episodes.length > 0) {
    const latest = episodes[0];
    featured = {
      slug: latest.slug,
      title: latest.title,
      summary: latest.summary,
      episode_number: latest.episode_number,
      canWatchFull: latest.canWatchFull,
      thumbnailUrl: await resolveMediaUrl(latest.thumbnail_url),
    };
  }

  return (
    <LearningWithJaxMotion
      pillarCounts={pillarCounts}
      trackCounts={trackCounts}
      featured={featured}
    />
  );
}
