import { describe, expect, it } from "vitest";
import {
  episodeAvailableAtForTier,
  episodePublicAt,
  isEpisodeListable,
  isEpisodeLiveForTier,
} from "@/lib/jax/episodes";
import {
  isAllowedStatusTransition,
  validateJaxMedia,
  jaxMediaPath,
} from "@/lib/jax/adminEpisodes";

// Public release: 2026-07-20 00:00 UTC
const PUBLISH_AT = "2026-07-20T00:00:00Z";
const at = (iso: string) => new Date(iso);
const TIERS = ["Free", "Basic", "Plus", "Premium"] as const;

const ep = (overrides: Record<string, unknown> = {}) => ({
  status: "approved" as const,
  publish_at: PUBLISH_AT,
  published_at: null,
  members_only: false,
  ...overrides,
});

describe("publishing automation (brief 2026-07-16 P1 §2)", () => {
  it("draft and in_review are never visible, any tier, any time", () => {
    const later = at("2027-01-01T00:00:00Z");
    for (const status of ["draft", "in_review"] as const) {
      for (const tier of TIERS) {
        expect(isEpisodeLiveForTier(ep({ status }), tier, later)).toBe(false);
      }
    }
  });

  it("approved + publish_at in the future → auto-publishes at the scheduled time (no human at the switch)", () => {
    const before = at("2026-07-19T23:59:00Z");
    const after = at("2026-07-20T00:00:00Z");
    expect(isEpisodeLiveForTier(ep(), "Free", before)).toBe(false);
    expect(isEpisodeLiveForTier(ep(), "Free", after)).toBe(true);
  });

  it("status=published is live immediately regardless of publish_at", () => {
    const wayBefore = at("2026-01-01T00:00:00Z");
    expect(isEpisodeLiveForTier(ep({ status: "published" }), "Free", wayBefore)).toBe(true);
  });

  it("approved with no schedule is not live", () => {
    expect(isEpisodeLiveForTier(ep({ publish_at: null }), "Premium", at("2027-01-01T00:00:00Z"))).toBe(false);
  });

  it("tier early-access windows apply on top: 168h Premium / 72h Plus / 24h Basic", () => {
    const at167h = at("2026-07-13T01:00:00Z");
    expect(isEpisodeLiveForTier(ep(), "Premium", at167h)).toBe(true);
    expect(isEpisodeLiveForTier(ep(), "Plus", at167h)).toBe(false);

    const at71h = at("2026-07-17T01:00:00Z");
    expect(isEpisodeLiveForTier(ep(), "Plus", at71h)).toBe(true);
    expect(isEpisodeLiveForTier(ep(), "Basic", at71h)).toBe(false);

    const at23h = at("2026-07-19T01:00:00Z");
    expect(isEpisodeLiveForTier(ep(), "Basic", at23h)).toBe(true);
    expect(isEpisodeLiveForTier(ep(), "Free", at23h)).toBe(false);
  });

  it("members_only stays Premium-only even after public release", () => {
    const after = at("2026-08-01T00:00:00Z");
    expect(isEpisodeLiveForTier(ep({ members_only: true }), "Premium", after)).toBe(true);
    expect(isEpisodeLiveForTier(ep({ members_only: true }), "Plus", after)).toBe(false);
    expect(isEpisodeLiveForTier(ep({ members_only: true, status: "published" }), "Free", after)).toBe(false);
  });

  it("legacy rows: published_at is honored when publish_at is null", () => {
    const legacy = ep({ publish_at: null, published_at: PUBLISH_AT });
    expect(episodePublicAt(legacy)?.toISOString()).toBe("2026-07-20T00:00:00.000Z");
    expect(isEpisodeLiveForTier(legacy, "Free", at(PUBLISH_AT))).toBe(true);
  });
});

describe("teaser rule — listable once the widest window opens", () => {
  it("during Premium's early window, Free can LIST the episode (teaser) but not watch full", () => {
    const at100h = at("2026-07-15T20:00:00Z"); // inside 168h, outside 72h
    expect(isEpisodeListable(ep(), "Free", at100h)).toBe(true);
    expect(isEpisodeLiveForTier(ep(), "Free", at100h)).toBe(false);
  });

  it("before any window opens, nothing is listed", () => {
    const at200h = at("2026-07-11T00:00:00Z");
    expect(isEpisodeListable(ep(), "Premium", at200h)).toBe(false);
  });

  it("members_only episodes are never listed to non-Premium (not even teasers)", () => {
    const after = at("2026-08-01T00:00:00Z");
    expect(isEpisodeListable(ep({ members_only: true }), "Free", after)).toBe(false);
    expect(isEpisodeListable(ep({ members_only: true }), "Premium", after)).toBe(true);
  });
});

describe("episodeAvailableAtForTier", () => {
  it("derives unlock time from publish_at − tierEarlyHours", () => {
    expect(episodeAvailableAtForTier(ep(), "Premium")?.toISOString()).toBe("2026-07-13T00:00:00.000Z");
    expect(episodeAvailableAtForTier(ep(), "Free")?.toISOString()).toBe("2026-07-20T00:00:00.000Z");
    expect(episodeAvailableAtForTier(ep({ publish_at: null }), "Free")).toBeNull();
  });
});

describe("admin manager helpers", () => {
  it("status transitions: draft → in_review → approved → published, with corrective backward moves", () => {
    expect(isAllowedStatusTransition("draft", "in_review")).toBe(true);
    expect(isAllowedStatusTransition("in_review", "approved")).toBe(true);
    expect(isAllowedStatusTransition("approved", "published")).toBe(true);
    expect(isAllowedStatusTransition("published", "approved")).toBe(true);
    // no skipping straight to published
    expect(isAllowedStatusTransition("draft", "published")).toBe(false);
    expect(isAllowedStatusTransition("in_review", "published")).toBe(false);
  });

  it("media validation: MP4/WebM/MOV videos, PNG/JPG/WebP thumbnails, size caps", () => {
    expect(validateJaxMedia("video", "video/mp4", 500_000_000).ok).toBe(true);
    expect(validateJaxMedia("thumbnail", "image/png", 1_000_000).ok).toBe(true);
    expect(validateJaxMedia("video", "image/png", 1000).ok).toBe(false);
    expect(validateJaxMedia("thumbnail", "image/png", 20 * 1024 * 1024).ok).toBe(false);
    expect(validateJaxMedia("teaser", "video/mp4", 0).ok).toBe(false);
  });

  it("media paths key off episode id and kind", () => {
    expect(jaxMediaPath("ep-1", "video", "mp4")).toBe("episodes/ep-1/video.mp4");
    expect(jaxMediaPath("ep-1", "thumbnail", "png")).toBe("episodes/ep-1/thumbnail.png");
  });
});
