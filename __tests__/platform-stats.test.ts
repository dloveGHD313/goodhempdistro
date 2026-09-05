import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdminClient: () => {
    throw new Error("no db in unit tests");
  },
}));

import { buildStatTiles, getPlatformStats, type PlatformStats } from "@/lib/server/platformStats";

const base: PlatformStats = {
  activeVendors: 3,
  liveProducts: 1,
  categories: 179,
  publishedEpisodes: 2,
  projectsSubmitted: 0,
  readAt: 0,
};

describe("buildStatTiles — public numbers are DB counts or nothing", () => {
  it("renders only positive, known counts and pluralises correctly", () => {
    const tiles = buildStatTiles(base);
    expect(tiles.map((t) => t.label)).toEqual([
      "hemp categories",
      "founding vendors onboarded",
      "product live",
      "Learning with JAX episodes",
    ]);
    expect(tiles[0].value).toBe("179");
    expect(tiles[2].value).toBe("1");
  });

  it("drops zero and null counts instead of inventing values", () => {
    const tiles = buildStatTiles({ ...base, activeVendors: null, liveProducts: 0, publishedEpisodes: null });
    expect(tiles).toEqual([{ value: "179", label: "hemp categories" }]);
  });

  it("returns no tiles when nothing is readable", () => {
    expect(
      buildStatTiles({ activeVendors: null, liveProducts: null, categories: null, publishedEpisodes: null, projectsSubmitted: null, readAt: 0 }),
    ).toEqual([]);
  });

  it("formats large counts with thousands separators", () => {
    expect(buildStatTiles({ ...base, categories: 12345 })[0].value).toBe("12,345");
  });
});

describe("getPlatformStats — fail-soft", () => {
  it("returns nulls (not a throw) when the database is unreachable", async () => {
    const stats = await getPlatformStats();
    expect(stats.activeVendors).toBeNull();
    expect(stats.categories).toBeNull();
    expect(typeof stats.readAt).toBe("number");
  });
});
