import Link from "next/link";
import { Metadata } from "next";
import { brand } from "@/lib/brand";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getVisibleEpisodes } from "@/lib/jax/episodes";
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
 * Episode list gated by consumer tier (perks spec 2026-07-10 §6):
 * paid members see episodes 24h/72h/168h before public release; Premium
 * additionally sees members-only episodes. Gate runs server-side in
 * getVisibleEpisodes — jax_episodes has no anon RLS policies.
 */
export default async function WebisodesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { tier, episodes } = await getVisibleEpisodes(user?.id ?? null);
  const earlyHours = TIER_ENTITLEMENTS[tier].jaxEarlyAccessHours;

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
                Member perk active: you see new episodes {earlyHours / 24}{" "}
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
                get early access to every new episode.
              </span>
            )}
          </p>

          {episodes.length === 0 ? (
            <div className="surface-card p-8 text-center text-muted">
              Episode 001 is coming soon — check back shortly.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {episodes.map((ep) => (
                <div key={ep.id} className="surface-card p-6 flex flex-col">
                  <div className="text-sm text-muted mb-1">
                    {ep.episode_number != null ? `Episode ${String(ep.episode_number).padStart(3, "0")}` : "Episode"}
                    {ep.members_only && (
                      <span className="ml-2 text-[var(--brand-lime)] border border-[var(--brand-lime)]/40 bg-[var(--brand-lime)]/15 px-2 py-0.5 rounded-full text-xs">
                        Members only
                      </span>
                    )}
                    {new Date(ep.published_at) > new Date() && (
                      <span className="ml-2 text-amber-400 border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 rounded-full text-xs">
                        Early access
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-semibold mb-2">{ep.title}</h2>
                  {ep.summary && <p className="text-muted text-sm mb-4 flex-1">{ep.summary}</p>}
                  {ep.video_url ? (
                    <a
                      href={ep.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary inline-flex justify-center mt-auto"
                    >
                      Watch
                    </a>
                  ) : (
                    <span className="text-muted text-sm mt-auto">Video coming soon</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
