import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * Live platform counts for public marketing surfaces (home, wholesale, shop).
 *
 * CEO rule (zero silent failures, evidence-based claims only): every number
 * shown to the public comes from the database. No hand-typed "120+ vendors".
 * A count that cannot be read is `null`, and the UI hides it rather than
 * inventing a value. Results are cached for 5 minutes per server.
 */
export type PlatformStats = {
  /** vendors.status = 'active' (admin-activated; comped founding vendors included). */
  activeVendors: number | null;
  /** products approved + active (visible in the shop). */
  liveProducts: number | null;
  /** categories rows (what vendors can list under). */
  categories: number | null;
  /** jax_episodes approved with publish_at in the past (publicly watchable). */
  publishedEpisodes: number | null;
  /** project_submissions rows (builder/developer projects routed to vendors). */
  projectsSubmitted: number | null;
  /** Unix ms when the counts were read. */
  readAt: number;
};

async function countRows(
  table: string,
  filter?: (q: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<number | null> {
  try {
    const admin = getSupabaseAdminClient();
    let q = admin.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count, error } = await q;
    if (error) return null;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

async function readPlatformStats(): Promise<PlatformStats> {
  const [activeVendors, liveProducts, categories, publishedEpisodes, projectsSubmitted] =
    await Promise.all([
      countRows("vendors", (q) => q.eq("status", "active")),
      countRows("products", (q) => q.eq("status", "approved").eq("active", true)),
      countRows("categories"),
      countRows("jax_episodes", (q) =>
        q.eq("status", "approved").lte("publish_at", new Date().toISOString()),
      ),
      countRows("project_submissions"),
    ]);
  return { activeVendors, liveProducts, categories, publishedEpisodes, projectsSubmitted, readAt: Date.now() };
}

export const getPlatformStats = unstable_cache(readPlatformStats, ["platform-stats-v1"], {
  revalidate: 300,
  tags: ["platform-stats"],
});

export type StatTile = { value: string; label: string };

/**
 * Turn raw counts into display tiles, dropping anything unknown or zero —
 * a "0 vendors" tile is technically true but reads as broken, and a null is
 * a read failure we must not paper over with a made-up figure.
 */
export function buildStatTiles(stats: PlatformStats): StatTile[] {
  const tiles: StatTile[] = [];
  const push = (n: number | null, singular: string, plural: string) => {
    if (typeof n === "number" && Number.isFinite(n) && n > 0) {
      tiles.push({ value: n.toLocaleString("en-US"), label: n === 1 ? singular : plural });
    }
  };
  push(stats.categories, "hemp category", "hemp categories");
  push(stats.activeVendors, "founding vendor onboarded", "founding vendors onboarded");
  push(stats.liveProducts, "product live", "products live");
  push(stats.publishedEpisodes, "Learning with JAX episode", "Learning with JAX episodes");
  push(stats.projectsSubmitted, "builder project submitted", "builder projects submitted");
  return tiles;
}
