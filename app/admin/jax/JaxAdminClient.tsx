"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Episode = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  episode_number: number | null;
  pillar: string;
  track: string | null;
  members_only: boolean;
  status: "draft" | "in_review" | "approved" | "published";
  publish_at: string | null;
  video_url: string | null;
  teaser_video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  seo_tags: string[] | null;
};

const PILLARS = ["webisodes", "business", "basics", "deep_dives"] as const;
const TRACKS = ["", "building", "business", "science", "lifestyle"] as const;
const NEXT_STATUS: Record<Episode["status"], Array<{ to: Episode["status"]; label: string }>> = {
  draft: [{ to: "in_review", label: "Send to review" }],
  in_review: [
    { to: "approved", label: "Approve (CEO)" },
    { to: "draft", label: "Back to draft" },
  ],
  approved: [
    { to: "published", label: "Publish now" },
    { to: "in_review", label: "Back to review" },
  ],
  published: [{ to: "approved", label: "Unpublish (back to approved)" }],
};

const STATUS_COLORS: Record<Episode["status"], string> = {
  draft: "bg-gray-600 text-gray-100",
  in_review: "bg-yellow-600 text-yellow-100",
  approved: "bg-blue-600 text-blue-100",
  published: "bg-green-600 text-green-100",
};

export default function JaxAdminClient() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Episode | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/jax/episodes", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error || "Failed to load episodes");
      return;
    }
    setEpisodes(data.episodes || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, updates: Record<string, unknown>, doneMsg: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/jax/episodes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Update failed");
      setNotice(doneMsg);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  // #215 pattern: signed URL from upload-init, then browser → storage.
  const uploadMedia = async (episode: Episode, kind: "video" | "teaser" | "thumbnail", file: File) => {
    setBusy(episode.id);
    setError(null);
    try {
      const initRes = await fetch("/api/admin/jax/upload-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode_id: episode.id, kind, mime: file.type, size: file.size }),
      });
      const init = await initRes.json().catch(() => null);
      if (!initRes.ok) throw new Error(init?.error || "Could not prepare upload");
      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(init.bucket)
        .uploadToSignedUrl(init.path, init.token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      const field =
        kind === "video" ? "video_url" : kind === "teaser" ? "teaser_video_url" : "thumbnail_url";
      await patch(episode.id, { [field]: init.path }, `${kind} uploaded.`);
    } catch (err) {
      console.error("[admin/jax] upload failed:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
      setBusy(null);
    }
  };

  const EpisodeForm = ({ episode, onDone }: { episode: Episode | null; onDone: () => void }) => {
    const [form, setForm] = useState({
      title: episode?.title ?? "",
      slug: episode?.slug ?? "",
      summary: episode?.summary ?? "",
      description: episode?.description ?? "",
      episode_number: episode?.episode_number != null ? String(episode.episode_number) : "",
      pillar: episode?.pillar ?? "webisodes",
      track: episode?.track ?? "",
      members_only: episode?.members_only ?? false,
      publish_at: episode?.publish_at ? episode.publish_at.slice(0, 16) : "",
      duration_seconds: episode?.duration_seconds != null ? String(episode.duration_seconds) : "",
      seo_tags: (episode?.seo_tags ?? []).join(", "),
    });
    const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

    const save = async () => {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim().toLowerCase(),
        summary: form.summary.trim() || null,
        description: form.description.trim() || null,
        episode_number: form.episode_number.trim() === "" ? null : Number.parseInt(form.episode_number, 10),
        pillar: form.pillar,
        track: form.track || null,
        members_only: form.members_only,
        publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : null,
        duration_seconds: form.duration_seconds.trim() === "" ? null : Number.parseInt(form.duration_seconds, 10),
        seo_tags: form.seo_tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      setError(null);
      const res = await fetch(
        episode ? `/api/admin/jax/episodes/${episode.id}` : "/api/admin/jax/episodes",
        {
          method: episode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Save failed");
        return;
      }
      setNotice(episode ? "Episode saved." : "Episode created as draft.");
      onDone();
      await load();
    };

    return (
      <div className="surface-card p-6 space-y-3 border border-accent/40">
        <h3 className="text-lg font-semibold">{episode ? `Edit: ${episode.title}` : "New episode"}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm text-muted">Title
            <input className="input-shell w-full mt-1" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </label>
          <label className="text-sm text-muted">Slug (kebab-case)
            <input className="input-shell w-full mt-1" value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          </label>
          <label className="text-sm text-muted">Episode #
            <input type="number" className="input-shell w-full mt-1" value={form.episode_number} onChange={(e) => set("episode_number", e.target.value)} />
          </label>
          <label className="text-sm text-muted">Duration (seconds)
            <input type="number" className="input-shell w-full mt-1" value={form.duration_seconds} onChange={(e) => set("duration_seconds", e.target.value)} />
          </label>
          <label className="text-sm text-muted">Pillar
            <select className="input-shell w-full mt-1" value={form.pillar} onChange={(e) => set("pillar", e.target.value)}>
              {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-sm text-muted">Track
            <select className="input-shell w-full mt-1" value={form.track} onChange={(e) => set("track", e.target.value)}>
              {TRACKS.map((t) => <option key={t} value={t}>{t || "(none)"}</option>)}
            </select>
          </label>
          <label className="text-sm text-muted">Scheduled public time (auto-publishes once approved)
            <input type="datetime-local" className="input-shell w-full mt-1" value={form.publish_at} onChange={(e) => set("publish_at", e.target.value)} />
          </label>
          <label className="text-sm text-muted flex items-end gap-2 pb-1">
            <input type="checkbox" checked={form.members_only} onChange={(e) => set("members_only", e.target.checked)} />
            Members-only (Premium)
          </label>
        </div>
        <label className="text-sm text-muted block">Summary (card blurb)
          <textarea className="input-shell w-full mt-1" rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
        </label>
        <label className="text-sm text-muted block">Description (episode page)
          <textarea className="input-shell w-full mt-1" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </label>
        <label className="text-sm text-muted block">SEO tags (comma-separated)
          <input className="input-shell w-full mt-1" value={form.seo_tags} onChange={(e) => set("seo_tags", e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={save}>Save</button>
          <button className="btn-secondary" onClick={onDone}>Cancel</button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {error && <div className="p-3 rounded bg-red-500/20 text-red-200 text-sm">{error}</div>}
      {notice && <div className="p-3 rounded bg-green-500/20 text-green-200 text-sm">{notice}</div>}

      {creating ? (
        <EpisodeForm episode={null} onDone={() => setCreating(false)} />
      ) : (
        <button className="btn-primary" onClick={() => { setEditing(null); setCreating(true); }}>
          + New Episode
        </button>
      )}

      {episodes.map((ep) =>
        editing?.id === ep.id ? (
          <EpisodeForm key={ep.id} episode={editing} onDone={() => setEditing(null)} />
        ) : (
          <div key={ep.id} className="surface-card p-5 border border-white/10 rounded-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">
                    {ep.episode_number != null ? `EP ${String(ep.episode_number).padStart(3, "0")} — ` : ""}
                    {ep.title}
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[ep.status]}`}>
                    {ep.status.replace("_", " ")}
                  </span>
                  {ep.members_only && (
                    <span className="px-2 py-0.5 rounded text-xs bg-purple-700 text-purple-100">members only</span>
                  )}
                </div>
                <p className="text-xs text-muted mt-1">
                  {ep.pillar}{ep.track ? ` · ${ep.track}` : ""} · /{ep.slug}
                  {ep.publish_at ? ` · public ${new Date(ep.publish_at).toLocaleString()}` : " · no schedule"}
                </p>
                {ep.summary && <p className="text-sm text-muted mt-2">{ep.summary}</p>}
                <p className="text-xs text-muted mt-2">
                  {ep.video_url ? "🎬 video ✓" : "🎬 video —"} · {ep.teaser_video_url ? "▶ teaser ✓" : "▶ teaser —"} · {ep.thumbnail_url ? "🖼 thumb ✓" : "🖼 thumb —"}
                </p>
              </div>
              <button className="btn-secondary shrink-0" onClick={() => { setCreating(false); setEditing(ep); }}>
                Edit
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              {NEXT_STATUS[ep.status].map(({ to, label }) => (
                <button
                  key={to}
                  disabled={busy === ep.id}
                  onClick={() => patch(ep.id, { status: to }, `Status → ${to}.`)}
                  className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
              {(["video", "teaser", "thumbnail"] as const).map((kind) => (
                <label key={kind} className="text-xs px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 cursor-pointer">
                  Upload {kind}
                  <input
                    type="file"
                    className="hidden"
                    accept={kind === "thumbnail" ? "image/png,image/jpeg,image/webp" : "video/mp4,video/webm,video/quicktime"}
                    disabled={busy === ep.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMedia(ep, kind, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              ))}
              {busy === ep.id && <span className="text-xs text-muted">Working…</span>}
            </div>
          </div>
        )
      )}
    </div>
  );
}
