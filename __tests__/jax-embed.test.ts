import { describe, expect, it } from "vitest";
import { isExternalMediaUrl, parseVideoEmbed } from "@/lib/jax/embed";

describe("parseVideoEmbed", () => {
  it("parses every common YouTube link shape", () => {
    for (const u of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/live/dQw4w9WgXcQ",
    ]) {
      const e = parseVideoEmbed(u);
      expect(e?.provider, u).toBe("youtube");
      expect(e?.id, u).toBe("dQw4w9WgXcQ");
      expect(e?.src, u).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    }
  });

  it("parses Vimeo links, including unlisted hashes", () => {
    expect(parseVideoEmbed("https://vimeo.com/123456789")).toEqual({
      provider: "vimeo",
      id: "123456789",
      src: "https://player.vimeo.com/video/123456789",
    });
    expect(parseVideoEmbed("https://vimeo.com/123456789/abcdef12")?.src).toBe(
      "https://player.vimeo.com/video/123456789?h=abcdef12"
    );
  });

  it("rejects everything that is not a supported video link", () => {
    for (const u of [
      "episodes/abc/video.mp4",
      "https://cdn.example.com/video.mp4",
      "https://www.youtube.com/watch?v=short",
      "https://evil.com/youtube.com/watch?v=dQw4w9WgXcQ",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ]) {
      expect(parseVideoEmbed(u), String(u)).toBeNull();
    }
  });
});

describe("isExternalMediaUrl", () => {
  it("distinguishes links from storage paths", () => {
    expect(isExternalMediaUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isExternalMediaUrl("episodes/abc/video.mp4")).toBe(false);
    expect(isExternalMediaUrl(null)).toBe(false);
  });
});
