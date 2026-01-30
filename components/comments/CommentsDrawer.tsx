"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// Comments drawer fixes: scroll lock, touch handling, and focus timing.
import ProfileChip from "@/components/profile/ProfileChip";
import Drawer from "@/components/ui/Drawer";
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
  openToken: number;
  onClose: () => void;
  commentCount: number;
  isAdmin: boolean;
  onCountChange?: (count: number) => void;
};

type ReplyTarget = {
  id: string;
  name: string;
};

const commentsCache = new Map<string, { comments: CommentItem[]; count: number }>();

const setBodyScrollLock = (locked: boolean) => {
  if (typeof document === "undefined") return;
  const body = document.body;
  const html = document.documentElement;

  if (locked) {
    const scrollY = window.scrollY;
    if (!body.dataset.prevOverflow) body.dataset.prevOverflow = body.style.overflow || "";
    if (!body.dataset.prevTouchAction) body.dataset.prevTouchAction = body.style.touchAction || "";
    if (!html.dataset.prevOverscroll) html.dataset.prevOverscroll = html.style.overscrollBehavior || "";
    if (!body.dataset.prevPosition) body.dataset.prevPosition = body.style.position || "";
    if (!body.dataset.prevTop) body.dataset.prevTop = body.style.top || "";
    if (!body.dataset.prevWidth) body.dataset.prevWidth = body.style.width || "";
    body.dataset.scrollY = scrollY.toString();

    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    html.style.overscrollBehavior = "none";
  } else {
    const scrollY = parseInt(body.dataset.scrollY || "0", 10);
    body.style.overflow = body.dataset.prevOverflow ?? "";
    body.style.touchAction = body.dataset.prevTouchAction ?? "";
    body.style.position = body.dataset.prevPosition ?? "";
    body.style.top = body.dataset.prevTop ?? "";
    body.style.width = body.dataset.prevWidth ?? "";
    html.style.overscrollBehavior = html.dataset.prevOverscroll ?? "";
    window.scrollTo(0, scrollY);

    delete body.dataset.prevOverflow;
    delete body.dataset.prevTouchAction;
    delete html.dataset.prevOverscroll;
    delete body.dataset.prevPosition;
    delete body.dataset.prevTop;
    delete body.dataset.prevWidth;
    delete body.dataset.scrollY;
  }
};

const useDrawerHeight = () => {
  const [height, setHeight] = useState("80vh");

  useEffect(() => {
    const updateHeight = () => {
      const supportsDvh = typeof CSS !== "undefined" && CSS.supports("height", "100dvh");
      const isMobile = window.innerWidth < 768;
      if (isMobile && supportsDvh) {
        setHeight("70dvh");
      } else if (isMobile) {
        setHeight(`${window.innerHeight * 0.7}px`);
      } else {
        setHeight("80vh");
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  return height;
};

const formatShortTime = (value: string) => {
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  if (Number.isNaN(delta)) return "now";
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const makeTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function CommentsDrawer({
  postId,
  isOpen,
  openToken,
  onClose,
  commentCount,
  isAdmin,
  onCountChange,
}: Props) {
  const { userId } = useAuthUser();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [count, setCount] = useState(commentCount);
  const [newBody, setNewBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [drawerSide, setDrawerSide] = useState<"right" | "bottom">("right");
  const [profileSnapshot, setProfileSnapshot] = useState<{ name: string; avatarUrl: string | null } | null>(
    null
  );
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);
  const lastLoadedPostIdRef = useRef<string | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const drawerHeight = useDrawerHeight();

  const canPost = Boolean(userId);

  const clearFocusTimer = useCallback(() => {
    if (focusTimerRef.current) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
  }, []);

  const handleTextareaFocus = useCallback(() => {
    if (!composerRef.current || !isOpen) return;
    rafRef.current = window.requestAnimationFrame(() => {
      if (!composerRef.current) return;
      focusTimerRef.current = window.setTimeout(() => {
        if (!composerRef.current || !isOpen) return;
        composerRef.current.focus();
        if (window.innerWidth < 768) {
          const length = composerRef.current.value.length;
          composerRef.current.setSelectionRange(length, length);
        }
      }, 150);
    });
  }, [isOpen]);

  const handleContentInteraction = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
  }, []);

  const cleanupOnClose = useCallback(() => {
    if (controllerRef.current && !controllerRef.current.signal.aborted) {
      controllerRef.current.abort();
    }
    controllerRef.current = null;
    setActionMenuId(null);
    setReplyTarget(null);
    setNewBody("");
    setError(null);
    setSubmitting(false);
    setShowJump(false);
    setLoading(false);
    setStatus("idle");
    setBodyScrollLock(false);
    clearFocusTimer();
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (process.env.NODE_ENV !== "production") {
      console.debug("[comments-ui]", { postId, state: "idle", reason: "cleanup" });
    }
  }, [clearFocusTimer, postId]);

  const handleDrawerChange = useCallback(
    (next: boolean) => {
      if (!next) {
        cleanupOnClose();
        onClose();
      }
    },
    [cleanupOnClose, onClose]
  );

  const updateCount = useCallback(
    (next: number) => {
      setCount(next);
      onCountChange?.(next);
    },
    [onCountChange]
  );

  const fetchComments = useCallback(
    async (force = false) => {
      if (!isOpen) return;
      if (!postId) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[comments] missing postId");
        }
        setError("Missing post id");
        setStatus("error");
        return;
      }
      if (!force && status !== "idle") return;
      if (!force) {
        const cached = commentsCache.get(postId);
        if (cached) {
          setComments(cached.comments);
          updateCount(cached.count);
          setStatus("loaded");
          console.debug("[comments-ui]", { postId, state: "loaded", reason: "cache_hit" });
          return;
        }
      }
      if (status === "loading") return;
      const seq = ++requestSeq.current;
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();
      setLoading(true);
      setStatus("loading");
      setError(null);
      console.debug("[comments-ui]", { postId, state: "loading", reason: "open" });
      const url = `/api/posts/${postId}/comments`;
      try {
        const response = await fetch(url, {
          cache: "no-store",
          credentials: "include",
          signal: controllerRef.current.signal,
        });
        if (!response.ok) {
          let message = response.statusText;
          try {
            const json = await response.json();
            message = json?.error || json?.message || message;
          } catch {
            const text = await response.text();
            if (text) message = text;
          }
          throw new Error(`HTTP ${response.status} ${response.statusText}: ${message}`);
        }
        const payload = await response.json();
        if (!isOpen || seq !== requestSeq.current) return;
        const nextComments = payload.comments || [];
        const nextCount = payload.count ?? commentCount;
        commentsCache.set(postId, { comments: nextComments, count: nextCount });
        setComments(nextComments);
        updateCount(nextCount);
        lastLoadedPostIdRef.current = postId;
        setStatus("loaded");
        console.debug("[comments-ui]", { postId, state: "loaded", reason: "fetch_success" });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (process.env.NODE_ENV !== "production") {
          console.error("Comments fetch failed", { postId, url, error: err });
        }
        setError(err instanceof Error ? err.message : "Failed to load comments.");
        setStatus("error");
        console.debug("[comments-ui]", { postId, state: "error", reason: "fetch_error" });
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
        }
      }
    },
    [isOpen, postId, commentCount, status, updateCount]
  );

  useEffect(() => {
    if (!isOpen) return;
    setBodyScrollLock(true);
    fetchComments();
  }, [fetchComments, isOpen, openToken]);

  useEffect(() => {
    if (!isOpen) {
      cleanupOnClose();
    }
    return () => {
      cleanupOnClose();
    };
  }, [cleanupOnClose, isOpen]);

  useEffect(() => {
    if (!postId) return;
    if (lastLoadedPostIdRef.current && lastLoadedPostIdRef.current !== postId) {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setStatus("idle");
      setComments([]);
      setError(null);
    }
  }, [postId]);

  useEffect(() => {
    updateCount(commentCount);
  }, [commentCount, updateCount]);

  useEffect(() => {
    if (!isOpen || !canPost) return;
    handleTextareaFocus();
  }, [isOpen, canPost]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handle = () => setDrawerSide(mediaQuery.matches ? "bottom" : "right");
    handle();
    mediaQuery.addEventListener("change", handle);
    return () => mediaQuery.removeEventListener("change", handle);
  }, []);

  useEffect(() => {
    if (!isOpen || !userId) return;
    const loadProfile = async () => {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      const displayName = payload?.profile?.display_name || payload?.profile?.displayName || null;
      const name = getDisplayName({ id: userId, display_name: displayName }, null);
      setProfileSnapshot({ name, avatarUrl: payload?.profile?.avatar_url || null });
    };
    loadProfile();
  }, [isOpen, userId]);

  useEffect(() => {
    if (!justAddedId) return;
    const timer = window.setTimeout(() => setJustAddedId(null), 1200);
    return () => window.clearTimeout(timer);
  }, [justAddedId]);

  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    const nearBottom = distance < 140;
    nearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowJump(false);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, []);

  const insertOptimisticComment = useCallback(
    (body: string, parentId: string | null) => {
      if (!userId) return { updated: comments, tempId: "" };
      const tempId = makeTempId();
      const now = new Date().toISOString();
      const displayName = profileSnapshot?.name || getDisplayName({ id: userId }, null);
      const optimistic: CommentItem = {
        id: tempId,
        postId,
        parentId,
        body,
        createdAt: now,
        authorId: userId,
        authorDisplayName: displayName,
        authorAvatarUrl: profileSnapshot?.avatarUrl || null,
        authorBadgeModel: null,
        replies: [],
      };
      let nextComments = comments;
      if (parentId) {
        nextComments = comments.map((comment) => {
          if (comment.id !== parentId) return comment;
          return { ...comment, replies: [...comment.replies, optimistic] };
        });
      } else {
        nextComments = [optimistic, ...comments];
      }
      setComments(nextComments);
      updateCount(count + 1);
      setJustAddedId(tempId);
      if (nearBottomRef.current) {
        requestAnimationFrame(scrollToBottom);
      } else {
        setShowJump(true);
      }
      return { updated: nextComments, tempId };
    },
    [comments, count, postId, profileSnapshot, scrollToBottom, updateCount, userId]
  );

  const handleSubmit = async () => {
    if (!canPost || submitting) return;
    const trimmed = newBody.trim();
    if (!trimmed) return;
    const parentId = replyTarget?.id || null;
    const previous = comments;
    const previousCount = count;
    const { tempId } = insertOptimisticComment(trimmed, parentId);
    setNewBody("");
    setReplyTarget(null);
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: trimmed, parentId }),
      });
      if (!response.ok) {
        let message = response.statusText;
        try {
          const json = await response.json();
          message = json?.error || json?.message || message;
        } catch {
          const text = await response.text();
          if (text) message = text;
        }
        throw new Error(`Failed to post comment: ${message}`);
      }
      const payload = await response.json();
      const real = payload.comment as CommentItem;
      setComments((current) => {
        const replace = (items: CommentItem[]): CommentItem[] =>
          items.map((item) => {
            if (item.id === tempId) return { ...real, replies: item.replies };
            return {
              ...item,
              replies: item.replies ? replace(item.replies) : [],
            };
          });
        return replace(current);
      });
    } catch (err) {
      setComments(previous);
      updateCount(previousCount);
      setError(err instanceof Error ? err.message : "Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Delete this comment? This removes it from the thread.")) return;
    const response = await fetch(`/api/comments/${commentId}`, {
      method: "DELETE",
      credentials: "include",
    });
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
    const isOwner = userId === comment.authorId;
    const highlight = comment.id === justAddedId;
    return (
      <div
        key={comment.id}
        className={`space-y-2 rounded-xl p-3 border ${
          highlight ? "border-[var(--brand-lime)]/60 bg-[var(--brand-lime)]/10" : "border-transparent"
        } ${depth ? "ml-4 border-l border-[var(--border)]/60" : ""}`}
      >
        <div className="flex items-center justify-between">
          <ProfileChip
            displayName={displayName}
            avatarUrl={comment.authorAvatarUrl}
            role={"consumer" as PostAuthorRole}
            tier={"none" as PostAuthorTier}
            badgeModel={comment.authorBadgeModel ?? null}
          />
          <span className="text-xs text-muted">{formatShortTime(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-white/90 whitespace-pre-line">{comment.body}</p>
        <div className="flex gap-3 text-xs text-muted items-center">
          {canPost && depth === 0 && (
            <button
              type="button"
              className="hover:text-accent"
              onClick={() => {
                setActionMenuId(null);
                setReplyTarget({
                  id: comment.id,
                  name: displayName,
                });
              }}
            >
              Reply
            </button>
          )}
          {(isOwner || isAdmin) && (
            <div className="relative">
              <button
                type="button"
                className="hover:text-accent"
                onClick={() => setActionMenuId((prev) => (prev === comment.id ? null : comment.id))}
                aria-label="Comment actions"
              >
                ⋯
              </button>
              {actionMenuId === comment.id && (
                <div className="absolute z-10 mt-2 w-32 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5"
                    onClick={() => {
                      setActionMenuId(null);
                      handleDelete(comment.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {comment.replies.map((reply) => renderComment(reply, depth + 1))}
      </div>
    );
  };

  const skeletons = useMemo(
    () =>
      Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="space-y-3 animate-pulse">
          <div className="h-10 bg-white/5 rounded-lg" />
          <div className="h-4 bg-white/5 rounded-lg w-3/4" />
        </div>
      )),
    []
  );

  const composerPlaceholder = canPost ? "Write a comment..." : "Sign in to comment";

  return (
    <Drawer open={isOpen} onOpenChange={handleDrawerChange} title="Comments" side={drawerSide}>
      <div
        className="flex flex-col h-full"
        onPointerDown={handleContentInteraction}
        onTouchStart={handleContentInteraction}
        onClick={handleContentInteraction}
        style={{ height: drawerSide === "bottom" ? drawerHeight : "100%" }}
      >
        <div className="flex-shrink-0 sticky top-0 z-10 backdrop-blur-md bg-[var(--surface)]/90 border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                Comments
                <span className="text-xs px-2 py-1 rounded-full bg-white/5 border border-[var(--border)]">
                  {count}
                </span>
              </h2>
              <p className="text-xs text-muted mt-1">
                Be respectful — keep it hemp-friendly 🌿
              </p>
            </div>
            <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close comments">
              Close
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onPointerDown={handleContentInteraction}
          onTouchStart={handleContentInteraction}
          onClick={handleContentInteraction}
          className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-5"
          style={{
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            willChange: "scroll-position",
            scrollBehavior: "smooth",
            position: "relative",
          }}
        >
          {error && (
            <div className="card-glass p-4 border border-red-500/40">
              <p className="text-sm font-semibold text-red-300">Couldn’t load comments</p>
              <p className="text-xs text-red-200 mt-1">{error}</p>
              <button type="button" className="btn-secondary mt-3" onClick={() => fetchComments(true)}>
                Retry
              </button>
            </div>
          )}
          {loading ? (
            <div className="space-y-6">{skeletons}</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-muted py-12">
              <p className="text-lg font-semibold">Start the conversation</p>
              <p className="text-sm mt-2">Be the first to drop a comment.</p>
            </div>
          ) : (
            <div className="space-y-6">{comments.map((comment) => renderComment(comment, 0))}</div>
          )}
        </div>

        {showJump && (
          <div
            className="px-6 py-2 border-t border-[var(--border)] bg-[var(--surface)]/90"
            onPointerDown={handleContentInteraction}
            onTouchStart={handleContentInteraction}
            onClick={handleContentInteraction}
          >
            <button type="button" className="btn-secondary w-full" onClick={scrollToBottom}>
              Jump to latest
            </button>
          </div>
        )}

        <div
          className="flex-shrink-0 sticky bottom-0 z-10 backdrop-blur-md bg-[var(--surface)]/95 border-t border-[var(--border)] px-6 py-4 space-y-3"
          onPointerDown={handleContentInteraction}
          onTouchStart={handleContentInteraction}
          onClick={handleContentInteraction}
        >
          {replyTarget && (
            <div className="flex items-center justify-between bg-[var(--surface)]/80 border border-[var(--border)] rounded-full px-3 py-1 text-xs">
              <span>Replying to {replyTarget.name}</span>
              <button type="button" className="text-muted" onClick={() => setReplyTarget(null)}>
                ✕
              </button>
            </div>
          )}
          <textarea
            ref={composerRef}
            value={newBody}
            onChange={(event) => setNewBody(event.target.value)}
            placeholder={composerPlaceholder}
            disabled={!canPost}
            className="w-full min-h-[48px] max-h-[140px] px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-white disabled:opacity-60 resize-none"
            maxLength={1000}
            aria-label="Comment composer"
            style={{ touchAction: "manipulation", fontSize: "16px" }}
            onPointerDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onFocus={handleTextareaFocus}
          />
          <div className="flex items-center justify-between">
            {!canPost && (
              <a href="/login" className="text-xs text-accent">
                Sign in to comment
              </a>
            )}
            <button
              type="button"
              className="btn-primary ml-auto"
              disabled={!canPost || !newBody.trim()}
              onClick={handleSubmit}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
