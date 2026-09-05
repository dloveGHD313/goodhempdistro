import Link from "next/link";
import { buildStatTiles, type PlatformStats } from "@/lib/server/platformStats";
import SectionReveal from "./SectionReveal";

type LiveStatsSectionProps = {
  stats: PlatformStats | null;
};

/**
 * "Live right now" — every figure is a database count read at render time
 * (5-minute cache). Nothing hand-typed. If a count can't be read or is zero
 * the tile is simply not shown, and if nothing can be shown the section
 * collapses to a single honest line instead of inventing numbers.
 */
export default function LiveStatsSection({ stats }: LiveStatsSectionProps) {
  const tiles = stats ? buildStatTiles(stats) : [];

  return (
    <section className="border-t border-b border-white/10 bg-[#0A100D] px-6 py-10">
      <SectionReveal>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="ghd-live-dot" aria-hidden />
            <p className="text-xs uppercase tracking-[0.3em] text-[#3CB97A]">Live on the platform right now</p>
          </div>

          {tiles.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {tiles.slice(0, 4).map((t, i) => (
                <div key={t.label} className="ghd-stat" style={{ animationDelay: `${i * 90}ms` }}>
                  <p className="text-4xl md:text-5xl font-serif text-[#F0EDE6]">{t.value}</p>
                  <p className="text-xs text-[#8A9E96] mt-2 uppercase tracking-wide">{t.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-[#8A9E96]">
              The founding cohort is onboarding now — counts appear here as vendors and products go live.
            </p>
          )}

          <p className="text-center text-xs text-[#4A5E57] mt-6">
            Counts come straight from the marketplace database and refresh every few minutes.{" "}
            <Link href="/categories" className="text-[#3CB97A] hover:underline">
              See every category →
            </Link>
          </p>
        </div>
      </SectionReveal>
    </section>
  );
}
