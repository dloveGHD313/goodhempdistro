import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { brand } from "@/lib/brand";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  episodeAvailableAtForTier,
  getEpisodeBySlugForViewer,
  resolveMediaUrl,
} from "@/lib/jax/episodes";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { episode } = await getEpisodeBySlugForViewer(slug, null);
  if (!episode) return { title: "Learning with Jax | Good Hemp Distro" };
  const ogImage = await resolveMediaUrl(episode.thumbnail_url);
  return {
    title: `${episode.title} | Learning with Jax`,
    description: episode.summary || "Learning with JAX — hemp industry education.",
    keywords: episode.seo_tags || undefined,
    openGraph: {
      title: episode.title,
      description: episode.summary || undefined,
      url: `${brand.url}/learning-with-jax/episodes/${episode.slug}`,
      siteName: brand.name,
      type: "video.episode",
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  };
}

/**
 * Episode detail (brief 2026-07-16 P1 §4): full video for tiers whose
 * window is open; public teaser + /pricing CTA otherwise. Playback URLs
 * are 1-hour signed URLs from the private jax-media bucket.
 */
export default async function EpisodePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { tier, episode } = await getEpisodeBySlugForViewer(slug, user?.id ?? null);
  if (!episode) notFound();

  const [fullUrl, teaserUrl, thumbUrl] = await Promise.all([
    episode.canWatchFull ? resolveMediaUrl(episode.video_url) : Promise.resolve(null),
    resolveMediaUrl(episode.teaser_video_url),
    resolveMediaUrl(episode.thumbnail_url),
  ]);
  const unlockAt = episodeAvailableAtForTier(episode, tier);

  const playbackUrl = episode.canWatchFull ? fullUrl : teaserUrl;

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell max-w-4xl mx-auto">
          <Link
            href="/learning-with-jax/webisodes"
            className="text-accent hover:underline mb-6 inline-block"
          >
            ← All episodes
          </Link>

          <div className="text-sm text-muted mb-2">
            {episode.episode_number != null
              ? `Episode ${String(episode.episode_number).padStart(3, "0")}`
              : "Episode"}
            {episode.members_only && (
              <span className="ml-2 text-[var(--brand-lime)]">Members only</span>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-4 text-accent">{episode.title}</h1>

          <div className="card-glass overflow-hidden rounded-xl mb-6">
            {playbackUrl ? (
              <video
                controls
                playsInline
                poster={thumbUrl ?? undefined}
                className="w-full aspect-video bg-black"
                src={playbackUrl}
              />
            ) : (
              <div className="aspect-video bg-[var(--surface)]/60 flex flex-col items-center justify-center gap-3 text-center p-6">
                <span className="text-6xl">🎬</span>
                <p className="text-muted text-sm">
                  {episode.canWatchFull
                    ? "Video is being prepared — check back soon."
                    : "The teaser is on its way — full episode is a member perk."}
                </p>
              </div>
            )}
          </div>

          {!episode.canWatchFull && (
            <div className="card-glass p-5 mb-6 border border-[var(--brand-lime)]/40">
              <p className="font-semibold text-[var(--brand-lime)] mb-1">
                🔒 You&apos;re watching the free teaser
              </p>
              <p className="text-sm text-muted mb-3">
                Members unlock full episodes early
                {unlockAt
                  ? ` — this one opens for everyone ${unlockAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
                  : ""}
                . Premium members get members-only episodes and the full archive.
              </p>
              <Link href="/pricing?tab=consumer" className="btn-primary inline-flex">
                See membership perks →
              </Link>
            </div>
          )}

          {episode.description && (
            <p className="text-muted leading-relaxed whitespace-pre-line mb-8">
              {episode.description}
            </p>
          )}

          <p className="text-xs text-muted">
            Learn it. Grow it. Get it. — JAX · Good Hemp Distro
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
