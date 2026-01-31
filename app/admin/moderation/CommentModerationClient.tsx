"use client";

import { useCallback, useEffect, useState } from "react";

type ModComment = {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  authorId: string;
  authorDisplayName: string;
  authorEmail: string | null;
  isDeleted: boolean;
  isPinned: boolean;
  isFeatured: boolean;
  priorityRank: number;
  isLocked: boolean;
  moderationNote: string | null;
  reportCount: number;
  replyCount: number;
};

type TabId = "reported" | "all" | "deleted" | "reports";

type ModReport = {
  id: string;
  commentId: string;
  reporterId: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
  status: string;
  comment: {
    id: string;
    postId: string;
    body: string;
    authorDisplayName: string;
    authorEmail: string | null;
    isDeleted: boolean;
  } | null;
  reporterDisplayName: string | null;
  reporterEmail: string | null;
};

export default function CommentModerationClient() {
  const [tab, setTab] = useState<TabId>("reported");
  const [comments, setComments] = useState<ModComment[]>([]);
  const [reports, setReports] = useState<ModReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [priorityDraft, setPriorityDraft] = useState<Record<string, number>>({});

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/moderation/reports", {
        cache: "no-store",
        credentials: "include",
      });
      if (response.status === 403) {
        setError("Not permitted. Admin access required.");
        setReports([]);
        return;
      }
      if (!response.ok) throw new Error("Failed to load reports.");
      const data = await response.json();
      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tab === "reported") {
        params.set("status", "open");
        params.set("reportedOnly", "true");
      } else if (tab === "deleted") {
        params.set("status", "deleted");
      } else {
        params.set("status", "open");
      }
      if (search) params.set("search", search);
      const response = await fetch(`/api/admin/moderation/comments?${params}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (response.status === 403) {
        setError("Not permitted. Admin access required.");
        setComments([]);
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to load comments.");
      }
      const data = await response.json();
      setComments(data.comments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments.");
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    if (tab === "reports") {
      loadReports();
    } else {
      loadComments();
    }
  }, [tab, loadComments, loadReports]);

  const patchReportStatus = async (reportId: string, status: string) => {
    setUpdatingId(reportId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/moderation/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update report.");
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setUpdatingId(null);
    }
  };

  const patchComment = async (commentId: string, payload: Record<string, unknown>) => {
    setUpdatingId(commentId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/moderation/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update.");
      }
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {(["reported", "reports", "all", "deleted"] as TabId[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-accent/20 text-accent"
                : "bg-[var(--surface)] text-muted hover:text-white"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "reported" ? "Reported" : t === "reports" ? "Reports" : t === "all" ? "All Comments" : "Deleted"}
          </button>
        ))}
        {tab !== "reports" && (
          <input
            type="text"
            placeholder="Search body..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ml-auto px-3 py-1.5 rounded-lg bg-[var(--surface)] text-sm text-white border border-[var(--border)] min-w-[160px]"
          />
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : tab === "reports" ? (
        reports.length === 0 ? (
          <p className="text-muted">No reports.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="card-glass p-4 space-y-2 border border-[var(--border)]">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-medium">{r.reason}</p>
                    {r.details && <p className="text-xs text-muted mt-0.5">{r.details}</p>}
                    <p className="text-xs text-muted mt-1">
                      Reporter: {r.reporterDisplayName || "Unknown"}
                      {r.reporterEmail && ` (${r.reporterEmail})`}
                    </p>
                    {r.comment && (
                      <p className="text-xs text-white/70 mt-1 line-clamp-2">{r.comment.body}</p>
                    )}
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(r.createdAt).toLocaleString()} • Status: {r.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {(["open", "reviewed", "dismissed", "actioned"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`px-2 py-0.5 text-xs rounded ${
                          r.status === s
                            ? "bg-accent/30 text-accent"
                            : "bg-[var(--surface)] text-muted hover:text-white"
                        }`}
                        disabled={updatingId === r.id}
                        onClick={() => patchReportStatus(r.id, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : comments.length === 0 ? (
        <p className="text-muted">
          {tab === "reported"
            ? "No reported comments."
            : tab === "deleted"
              ? "No deleted comments."
              : "No comments."}
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className="card-glass p-4 space-y-2 border border-[var(--border)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/90 whitespace-pre-line line-clamp-2">
                    {c.body}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0 mt-1 text-xs text-muted">
                    <span>{c.authorDisplayName}</span>
                    {c.authorEmail && <span>{c.authorEmail}</span>}
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                    <span>{c.replyCount} replies</span>
                    {c.reportCount > 0 && (
                      <span className="text-amber-400">{c.reportCount} reports</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-accent hover:underline shrink-0"
                  onClick={() => setDetailId(detailId === c.id ? null : c.id)}
                >
                  {detailId === c.id ? "Hide" : "Details"}
                </button>
              </div>

              {detailId === c.id && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-sm text-white/80 whitespace-pre-wrap">{c.body}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={c.isPinned}
                    onChange={(e) =>
                      patchComment(c.id, { is_pinned: e.target.checked })
                    }
                    disabled={updatingId === c.id}
                    className="rounded"
                  />
                  Pin
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={c.isFeatured}
                    onChange={(e) =>
                      patchComment(c.id, { is_featured: e.target.checked })
                    }
                    disabled={updatingId === c.id}
                    className="rounded"
                  />
                  Feature
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={c.isLocked}
                    onChange={(e) =>
                      patchComment(c.id, { is_locked: e.target.checked })
                    }
                    disabled={updatingId === c.id}
                    className="rounded"
                  />
                  Lock
                </label>
                <span className="text-xs text-muted">Priority:</span>
                <input
                  type="number"
                  value={priorityDraft[c.id] ?? c.priorityRank}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setPriorityDraft((prev) => ({
                      ...prev,
                      [c.id]: Number.isNaN(v) ? c.priorityRank : v,
                    }));
                  }}
                  onBlur={() => {
                    const v = priorityDraft[c.id];
                    if (v !== undefined && v !== c.priorityRank) {
                      patchComment(c.id, { priority_rank: v });
                      setPriorityDraft((prev) => {
                        const next = { ...prev };
                        delete next[c.id];
                        return next;
                      });
                    }
                  }}
                  disabled={updatingId === c.id}
                  className="w-16 px-2 py-0.5 rounded bg-[var(--surface)] text-sm border border-[var(--border)]"
                />
                {c.isDeleted ? (
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={updatingId === c.id}
                    onClick={() => patchComment(c.id, { is_deleted: false })}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary text-xs text-red-400"
                    disabled={updatingId === c.id}
                    onClick={() => {
                      if (!confirm("Soft delete this comment?")) return;
                      patchComment(c.id, { is_deleted: true });
                    }}
                  >
                    Soft Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
