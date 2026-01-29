"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type MediaItem = {
  media_type: "image" | "video";
  media_url: string;
  preview_url: string;
};

type Props = {
  userId: string;
  onPostCreated: (post: any, firstPost: boolean) => void;
  onMascotEvent: (detail: {
    message: string;
    mood: "SUCCESS" | "ERROR" | "BLOCKED" | "CHILL";
    move?: "success_nod" | "error_shake" | "attention_pop";
  }) => void;
  isPaidUser?: boolean;
};

const MAX_CONTENT_LENGTH = 2000;
const MAX_MEDIA_ITEMS = 6;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, "_");

export default function PostComposer({ userId, onPostCreated, onMascotEvent, isPaidUser }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const remaining = MAX_CONTENT_LENGTH - content.length;

  const validateMedia = (file: File, type: "image" | "video") => {
    if (type === "image" && !IMAGE_TYPES.has(file.type)) {
      return "Images must be JPG, PNG, or WEBP.";
    }
    if (type === "video" && !VIDEO_TYPES.has(file.type)) {
      return "Videos must be MP4 or WEBM.";
    }
    if (type === "image" && file.size > MAX_IMAGE_BYTES) {
      return "Images must be under 10MB.";
    }
    if (type === "video" && file.size > MAX_VIDEO_BYTES) {
      return "Videos must be under 50MB.";
    }
    return null;
  };

  const uploadMedia = async (files: FileList | null, type: "image" | "video") => {
    if (!files?.length) return;
    if (media.length + files.length > MAX_MEDIA_ITEMS) {
      setError(`Limit ${MAX_MEDIA_ITEMS} media items per post.`);
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(10);

    const uploaded: MediaItem[] = [];
    try {
      for (const file of Array.from(files)) {
        const validation = validateMedia(file, type);
        if (validation) {
          throw new Error(validation);
        }

        const safeName = sanitizeFileName(file.name);
        const unique = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now());
        const bucket = type === "image" ? "post-images" : "post-videos";
        const filePath = `${userId}/${unique}-${safeName}`;

        setUploadProgress(45);
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
        const publicUrl = data.publicUrl;
        uploaded.push({
          media_type: type,
          media_url: publicUrl,
          preview_url: publicUrl,
        });
        setUploadProgress(80);
      }

      setMedia((prev) => [...prev, ...uploaded]);
      setUploadProgress(100);
      onMascotEvent({
        message: "Upload complete.",
        mood: "SUCCESS",
        move: "success_nod",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      onMascotEvent({
        message: "Upload failed. Want me to help you try again?",
        mood: "ERROR",
        move: "error_shake",
      });
    } finally {
      setTimeout(() => setUploadProgress(0), 400);
      setUploading(false);
    }
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed && media.length === 0) {
      setError("Add a message or media to post.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          media: media.map(({ media_type, media_url }) => ({ media_type, media_url })),
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onMascotEvent({
            message: "Permission denied.",
            mood: "BLOCKED",
            move: "attention_pop",
          });
        }
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to create post.");
      }

      const payload = await response.json();
      onPostCreated(payload.post, payload.firstPost);
      setContent("");
      setMedia([]);
      const paid =
        typeof isPaidUser === "boolean"
          ? isPaidUser
          : payload.post?.author_tier && payload.post?.author_tier !== "none";
      onMascotEvent({
        message: paid ? "Posted.\nThis’ll get more eyes." : "Posted.\nThis one’s live.",
        mood: "SUCCESS",
        move: "success_nod",
      });
      if (payload.firstPost) {
        onMascotEvent({
          message: "First post. You’re on the board.",
          mood: "SUCCESS",
          move: "attention_pop",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create post.";
      setError(message);
      onMascotEvent({
        message: "Post failed to publish. Want me to troubleshoot?",
        mood: "ERROR",
        move: "error_shake",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card-glass p-6 space-y-4 feed-composer">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Create a post</h2>
        <span className={`text-xs ${remaining < 0 ? "text-red-400" : "text-muted"}`}>
          {remaining}
        </span>
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Share a product drop, event, or community update..."
        className="w-full min-h-[120px] px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white text-sm"
        maxLength={MAX_CONTENT_LENGTH}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-muted">Attach image</span>
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            multiple
            disabled={uploading || submitting}
            onChange={(event) => uploadMedia(event.target.files, "image")}
            className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-white hover:file:bg-accent/80 disabled:opacity-60"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-muted">Attach video</span>
          <input
            type="file"
            accept=".mp4,.webm"
            multiple
            disabled={uploading || submitting}
            onChange={(event) => uploadMedia(event.target.files, "video")}
            className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-white hover:file:bg-accent/80 disabled:opacity-60"
          />
        </label>
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="w-full bg-[var(--surface)] rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted">Uploading... {uploadProgress}%</p>
        </div>
      )}

      {media.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {media.map((item, index) => (
            <div key={`${item.media_url}-${index}`} className="feed-media-preview">
              {item.media_type === "image" ? (
                <img src={item.preview_url} alt="Upload preview" className="feed-media" />
              ) : (
                <video src={item.preview_url} controls className="feed-media" />
              )}
              <button
                type="button"
                onClick={() => removeMedia(index)}
                className="btn-ghost text-xs mt-2"
                disabled={uploading || submitting}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={uploading || submitting}
          className="btn-primary"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
        <button
          type="button"
          onClick={() => {
            setContent("");
            setMedia([]);
            setError(null);
          }}
          disabled={uploading || submitting}
          className="btn-ghost"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
