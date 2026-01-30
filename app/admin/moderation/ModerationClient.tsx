"use client";

import { useCallback, useEffect, useState } from "react";

type FlaggedPost = {
  id: string;
  post_id: string;
  flagged_by: string;
  reason: string | null;
  created_at: string;
  status: "open" | "dismissed" | "actioned";
  post: {
    id: string;
    author_id: string;
    content: string;
    created_at: string;
    is_deleted: boolean;
    authorDisplayName: string;
    authorAvatarUrl: string | null;
  } | null;
};

export default function ModerationClient() {
  const [flags, setFlags] = useState<FlaggedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/moderation", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load moderation queue.");
      }
      const payload = await response.json();
      setFlags((payload.flags || []) as FlaggedPost[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load moderation queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const updateFlag = async (flagId: string, action: "dismiss" | "actioned" | "delete_post") => {
    setUpdatingId(flagId);
    try {
      const response = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagId, action }),
      });
      if (!response.ok) {
        throw new Error("Failed to update flag.");
      }
      await loadFlags();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update flag.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="card-glass p-6">
        <p className="text-muted">Loading flagged posts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-glass p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (flags.length === 0) {
    return (
      <div className="card-glass p-6">
        <p className="text-muted">No open flags right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {flags.map((flag) => (
        <div key={flag.id} className="card-glass p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Flagged by</p>
              <p className="text-sm font-mono">{flag.flagged_by}</p>
            </div>
            <div className="text-xs text-muted">
              {new Date(flag.created_at).toLocaleString()}
            </div>
          </div>
          <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--surface)]/40">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{flag.post?.authorDisplayName || "Unknown"}</div>
              <div className="text-xs text-muted">
                {flag.post?.created_at ? new Date(flag.post.created_at).toLocaleString() : "Unknown"}
              </div>
            </div>
            <p className="text-sm text-muted mt-2">{flag.post?.content || "Post missing"}</p>
          </div>
          {flag.reason && (
            <div className="text-sm">
              <span className="text-muted">Reason:</span> {flag.reason}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={updatingId === flag.id}
              onClick={() => updateFlag(flag.id, "dismiss")}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={updatingId === flag.id}
              onClick={() => updateFlag(flag.id, "actioned")}
            >
              Mark actioned
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={updatingId === flag.id}
              onClick={() => {
                if (!confirm("Delete this post? This removes it from the feed.")) return;
                updateFlag(flag.id, "delete_post");
              }}
            >
              Delete post
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
