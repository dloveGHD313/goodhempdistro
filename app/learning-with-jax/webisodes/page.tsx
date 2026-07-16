import Link from "next/link";
import { Metadata } from "next";
import { brand } from "@/lib/brand";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getEpisodesForViewer, resolveMediaUrl } from "@/lib/jax/episodes";
import { TIER_ENTITLEMENTS } from "@/lib/entitlements";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Webisodes | Learning with Jax",
  description:
    "Short-form episodes with JAX on marketplace tips and industry news.",
  openGraph: {
    title: "Webisodes | Learning with Jax",
    description:
      "Short-form episodes with JAX on marketplace tips and industry news.",
    url: `${brand.url}/learning-with-jax/webisodes`,
    siteName: brand.name,
    type: "website",
  },
};

export const dynamic = "force-dynamic";

/**
 * Webisode list (brief 2026-07-16 P1): live, data-driven. Episodes are
 * listable once published or auto-published (approved + publish_at
 * reached, incl. the widest early-access window); viewers who can't
 * watch the full video yet see the public teaser + upgrade CTA.
 */
export default async function WebisodesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { tier, episodes } = await getEpisodesForViewer(user?.id ?? null);
  const webisodes = episodes.filter((ep) => ep.pillar === "webisodes");
  const earlyHours = TIER_ENTITLEMENTS[tier].jaxEarlyAccessHours;

  const thumbs = await Promise.all(
    webisodes.map((ep) => resolveMediaUrl(ep.thumbnail_url))
  );

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <Link
            href="/learning-with-jax"
            className="text-accent hover:underline mb-8 inline-block"
          >
            ← Learning with JAX
          </Link>

          <h1 className="text-3xl font-bold mb-2">Webisodes</h1>
          <p className="text-muted mb-8">
            Short-form episodes with JAX on marketplace tips and industry news.
            {earlyHours > 0 ? (
              <span className="block mt-1 text-[var(--brand-lime)]">
                Member perk active: you unlock new episodes {earlyHours / 24}{" "}
                {earlyHours === 24 ? "day" : "days"} early
                {TIER_ENTITLEMENTS[tier].jaxMembersOnly
                  ? ", plus members-only episodes and the full archive"
                  : ""}
                .
              </span>
            ) : (
              <span className="block mt-1">
                <Link href="/pricing?tab=consumer" className="text-accent hover:underline">
                  Members
                </Link>{" "}
                unlock every new episode early.
              </span>
            )}
          </p>

          {webisodes.length === 0 ? (
            <div className="surface-card p-8 text-center text-muted">
              First episodes dropping soon — check back shortly.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {webisodes.map((ep, i) => (
                <Link
                  key={ep.id}
                  href={`/learning-with-jax/episodes/${ep.slug}`}
                  className="surface-card p-0 overflow-hidden flex flex-col hover-lift"
                >
                  <div className="aspect-video bg-[var(--surface)]/60 relative">
                    {thumbs[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbs[i]!} alt={ep.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-5xl">🎬</div>
                    )}
                    {ep.teaserOnly && (
                      <span className="absolute top-2 right-2 text-xs bg-amber-500/90 text-black font-semibold px-2 py-0.5 rounded-full">
                        🔒 Early access — teaser available
                      </span>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="text-xs text-muted mb-1">
                      {ep.episode_number != null
                        ? `Episode ${String(ep.episode_number).padStart(3, "0")}`
                        : "Episode"}
                      {ep.members_only && (
                        <span className="ml-2 text-[var(--brand-lime)]">Members only</span>
                      )}
                      {ep.duration_seconds ? (
                        <span className="ml-2">{Math.round(ep.duration_seconds / 60) || 1} min</span>
                      ) : null}
                    </div>
                    <h2 className="text-lg font-semibold mb-1">{ep.title}</h2>
                    {ep.summary && (
                      <p className="text-muted text-sm flex-1">{ep.summary}</p>
                    )}
                    <span className="text-accent text-sm font-semibold mt-3">
                      {ep.canWatchFull ? "Watch →" : "Watch teaser →"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
