/**
 * Hosted-video embeds for Learning with JAX episodes.
 *
 * Supabase Storage on the current plan caps uploads at 50 MB and egress at a few GB a
 * month, which a 10-minute episode blows through in a few dozen plays. Full episodes
 * therefore live on YouTube (or Vimeo) and `jax_episodes.video_url` / `teaser_video_url`
 * hold the share link; storage paths and direct MP4 URLs keep working for short clips.
 * Pure helpers — unit-tested.
 */

export type VideoEmbed = { provider: "youtube" | "vimeo"; id: string; src: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Parse a YouTube (watch / youtu.be / shorts / embed / live) or Vimeo link. Null for anything else. */
export function parseVideoEmbed(value: string | null | undefined): VideoEmbed | null {
  if (!value || typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return YT_ID.test(id) ? youtube(id) : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    let id = url.searchParams.get("v") ?? "";
    if (!id && parts.length >= 2 && ["embed", "shorts", "live", "v"].includes(parts[0])) id = parts[1];
    return YT_ID.test(id) ? youtube(id) : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts.find((p) => /^\d{6,12}$/.test(p));
    if (!id) return null;
    const hash = parts[parts.indexOf(id) + 1];
    const q = hash && /^[a-f0-9]{6,12}$/i.test(hash) ? `?h=${hash}` : "";
    return { provider: "vimeo", id, src: `https://player.vimeo.com/video/${id}${q}` };
  }
  return null;
}

function youtube(id: string): VideoEmbed {
  return {
    provider: "youtube",
    id,
    src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
  };
}

/** True when a stored media value is an external link (embed or direct file) rather than a storage path. */
export function isExternalMediaUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

/** Storage upload ceiling on the current Supabase plan (Free: 50 MB). Shown in the admin UI. */
export const JAX_UPLOAD_LIMIT_MB = 50;
