"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProfileChip from "@/components/profile/ProfileChip";
import { getDisplayName } from "@/lib/identity";
import type { BadgeInfo } from "@/lib/badges";
import type { PostAuthorRole, PostAuthorTier } from "@/lib/postPriority";
import useAuthUser from "@/components/engagement/useAuthUser";

type CommentItem = {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  authorId: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorBadgeModel?: BadgeInfo | null;
  replies: CommentItem[];
};

type Props = {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  commentCount: number;
  isAdmin: boolean;
};

const formatTime = (value: string) => new Date(value).toLocaleString();

export default function CommentsDrawer({
  postId,
  isOpen,
  onClose,
  commentCount,
  isAdmin,
}: Props) {
  const { userId } = useAuthUser();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(commentCount);
  const [newBody, setNewBody] = useState("");
  const [replyBody, setReplyBody] = useState<Record<string, string>>({});
  const [activeReply, setActiveReply] = useState<string | null>(null);

  const canPost = Boolean(userId);

  const fetchComments = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load comments.");
      }
      const payload = await response.json();
      setComments(payload.comments || []);
      setCount(payload.count ?? commentCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments.");
    } finally {
      setLoading(false);
    }
  }, [isOpen, postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    setCount(commentCount);
  }, [commentCount]);

  const handleSubmit = async (body: string, parentId: string | null) => {
    if (!canPost) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    const response = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: trimmed, parentId }),
    });
    if (!response.ok) {
      setError("Failed to post comment.");
      return;
    }
    setError(null);
    if (parentId) {
      setReplyBody((prev) => ({ ...prev, [parentId]: "" }));
      setActiveReply(null);
    } else {
      setNewBody("");
    }
    await fetchComments();
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Delete this comment? This removes it from the thread.")) return;
    const response = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Failed to delete comment.");
      return;
    }
    await fetchComments();
  };

  const renderComment = (comment: CommentItem, depth: number) => {
    const displayName = getDisplayName({
      id: comment.authorId,
      display_name: comment.authorDisplayName ?? null,
    });
    return (
      <div key={comment.id} className={`space-y-2 ${depth ? "pl-6 border-l border-[var(--border)]" : ""}`}>
        <div className="flex items-center justify-between">
          <ProfileChip
            displayName={displayName}
            avatarUrl={comment.authorAvatarUrl}
            role={"consumer" as PostAuthorRole}
            tier={"none" as PostAuthorTier}
            badgeModel={comment.authorBadgeModel ?? null}
          />
          <span className="text-xs text-muted">{formatTime(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-white/90">{comment.body}</p>
        <div className="flex gap-3 text-xs text-muted">
          {canPost && depth === 0 && (
            <button
              type="button"
              className="hover:text-accent"
              onClick={() => setActiveReply((prev) => (prev === comment.id ? null : comment.id))}
            >
              Reply
            </button>
          )}
          {(userId === comment.authorId || isAdmin) && (
            <button
              type="button"
              className="hover:text-accent"
              onClick={() => handleDelete(comment.id)}
            >
              Delete
            </button>
          )}
        </div>
        {activeReply === comment.id && canPost && (
          <div className="space-y-2">
            <textarea
              value={replyBody[comment.id] || ""}
              onChange={(event) =>
                setReplyBody((prev) => ({ ...prev, [comment.id]: event.target.value }))
              }
              placeholder="Write a reply..."
              className="w-full min-h-[80px] px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded text-sm text-white"
              maxLength={1000}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setActiveReply(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={() => handleSubmit(replyBody[comment.id] || "", comment.id)}>
                Reply
              </button>
            </div>
          </div>
        )}
        {comment.replies.map((reply) => renderComment(reply, depth + 1))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="w-full max-w-xl h-full bg-[var(--surface)]/95 border-l border-[var(--border)] p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Comments ({count})</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        {loading ? (
          <p className="text-muted">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-muted">No comments yet.</p>
        ) : (
          <div className="space-y-6">{comments.map((comment) => renderComment(comment, 0))}</div>
        )}

        <div className="mt-6 border-t border-[var(--border)] pt-4 space-y-3">
          <h3 className="text-sm text-muted">Add a comment</h3>
          <textarea
            value={newBody}
            onChange={(event) => setNewBody(event.target.value)}
            placeholder={canPost ? "Write a comment..." : "Sign in to comment"}
            disabled={!canPost}
            className="w-full min-h-[100px] px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded text-sm text-white disabled:opacity-60"
            maxLength={1000}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary"
              disabled={!canPost || !newBody.trim()}
              onClick={() => handleSubmit(newBody, null)}
            >
              Post comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
