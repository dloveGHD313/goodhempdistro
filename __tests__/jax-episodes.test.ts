import { describe, expect, it } from "vitest";
import {
  episodeAvailableAtForTier,
  isEpisodeVisibleToTier,
} from "@/lib/jax/episodes";

// Public release: 2026-07-20 00:00 UTC
const PUBLISHED_AT = "2026-07-20T00:00:00Z";
const publicEpisode = { published_at: PUBLISHED_AT, members_only: false };
const membersEpisode = { published_at: PUBLISHED_AT, members_only: true };

const at = (iso: string) => new Date(iso);

describe("isEpisodeVisibleToTier (perks spec §6, verification #6)", () => {
  it("before any early window: nobody sees it", () => {
    const now = at("2026-07-12T00:00:00Z"); // 8 days early
    for (const tier of ["Free", "Basic", "Plus", "Premium"] as const) {
      expect(isEpisodeVisibleToTier(publicEpisode, tier, now)).toBe(false);
    }
  });

  it("168h early: only Premium sees it", () => {
    const now = at("2026-07-13T01:00:00Z"); // ~167h before release
    expect(isEpisodeVisibleToTier(publicEpisode, "Premium", now)).toBe(true);
    expect(isEpisodeVisibleToTier(publicEpisode, "Plus", now)).toBe(false);
    expect(isEpisodeVisibleToTier(publicEpisode, "Basic", now)).toBe(false);
    expect(isEpisodeVisibleToTier(publicEpisode, "Free", now)).toBe(false);
  });

  it("72h early: Plus and Premium; 24h early: Basic too; Free never early", () => {
    const at72h = at("2026-07-17T01:00:00Z");
    expect(isEpisodeVisibleToTier(publicEpisode, "Plus", at72h)).toBe(true);
    expect(isEpisodeVisibleToTier(publicEpisode, "Basic", at72h)).toBe(false);

    const at24h = at("2026-07-19T01:00:00Z");
    expect(isEpisodeVisibleToTier(publicEpisode, "Basic", at24h)).toBe(true);
    expect(isEpisodeVisibleToTier(publicEpisode, "Free", at24h)).toBe(false);
  });

  it("at/after public release: everyone sees it", () => {
    const now = at(PUBLISHED_AT);
    for (const tier of ["Free", "Basic", "Plus", "Premium"] as const) {
      expect(isEpisodeVisibleToTier(publicEpisode, tier, now)).toBe(true);
    }
  });

  it("members-only episodes: Premium only, even after public release", () => {
    const now = at("2026-08-01T00:00:00Z");
    expect(isEpisodeVisibleToTier(membersEpisode, "Premium", now)).toBe(true);
    expect(isEpisodeVisibleToTier(membersEpisode, "Plus", now)).toBe(false);
    expect(isEpisodeVisibleToTier(membersEpisode, "Basic", now)).toBe(false);
    expect(isEpisodeVisibleToTier(membersEpisode, "Free", now)).toBe(false);
  });
});

describe("episodeAvailableAtForTier", () => {
  it("derives members_available_at = published_at − tierEarlyHours", () => {
    expect(episodeAvailableAtForTier(publicEpisode, "Free").toISOString()).toBe(
      "2026-07-20T00:00:00.000Z"
    );
    expect(episodeAvailableAtForTier(publicEpisode, "Basic").toISOString()).toBe(
      "2026-07-19T00:00:00.000Z"
    );
    expect(episodeAvailableAtForTier(publicEpisode, "Plus").toISOString()).toBe(
      "2026-07-17T00:00:00.000Z"
    );
    expect(episodeAvailableAtForTier(publicEpisode, "Premium").toISOString()).toBe(
      "2026-07-13T00:00:00.000Z"
    );
  });
});
