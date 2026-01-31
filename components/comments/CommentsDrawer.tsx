"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
openToken?: number;
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
openToken = 0,
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
const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
const [actionMenuId, setActionMenuId] = useState<string | null>(null);
const [justAddedId, setJustAddedId] = useState<string | null>(null);
const [submitting, setSubmitting] = useState(false);
const [hasTextState, setHasTextState] = useState(false);
const [showJump, setShowJump] = useState(false);
const [drawerSide, setDrawerSide] = useState<"right" | "bottom">("right");
const [profileSnapshot, setProfileSnapshot] = useState<{ name: string; avatarUrl: string | null } | null>(
null
);
const textareaRef = useRef<HTMLTextAreaElement | null>(null);
const draftRef = useRef("");
const scrollRef = useRef<HTMLDivElement | null>(null);
const nearBottomRef = useRef(true);
const controllerRef = useRef<AbortController | null>(null);
const submittingRef = useRef(false);
const requestSeq = useRef(0);
const lastLoadedPostIdRef = useRef<string | null>(null);

const canPost = Boolean(userId);

const cleanupOnClose = useCallback(() => {
setActionMenuId(null);
setReplyTarget(null);
setError(null);
setStatus("idle");
setSubmitting(false);
submittingRef.current = false;
setShowJump(false);
if (controllerRef.current && !controllerRef.current.signal.aborted) {
controllerRef.current.abort();
}
controllerRef.current = null;
draftRef.current = "";
if (textareaRef.current) {
textareaRef.current.value = "";
}
}, []);

// Handle drawer close - ensure cleanup always runs
const handleDrawerChange = useCallback((open: boolean) => {
if (!open) {
cleanupOnClose();
onClose();
}
}, [cleanupOnClose, onClose]);

const updateCount = useCallback(
(next: number) => {
setCount(next);
onCountChange?.(next);
},
[onCountChange]
);

const countSubtree = useCallback((node: CommentItem): number => {
return 1 + (node.replies?.reduce((acc, reply) => acc + countSubtree(reply), 0) ?? 0);
}, []);

const removeById = useCallback(
(items: CommentItem[], id: string): { nextItems: CommentItem[]; removedCount: number } => {
let removedCount = 0;
const nextItems: CommentItem[] = [];
for (const item of items) {
if (item.id === id) {
removedCount += countSubtree(item);
continue;
}
const child = removeById(item.replies ?? [], id);
if (child.removedCount > 0) {
removedCount += child.removedCount;
nextItems.push({ ...item, replies: child.nextItems });
} else {
nextItems.push(item);
}
}
return { nextItems, removedCount };
},
[countSubtree]
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
if (!isOpen) return;
const timer = setTimeout(() => {
textareaRef.current?.focus();
if (process.env.NODE_ENV !== "production") {
console.debug("[composer]", { focused: document.activeElement === textareaRef.current });
}
}, 100);
return () => clearTimeout(timer);
}, [isOpen, openToken]);

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
if (submittingRef.current) return;
if (!canPost) {
setError("Sign in to comment.");
return;
}
const raw = textareaRef.current?.value ?? draftRef.current;
const trimmed = raw.trim();
if (!trimmed) return;
submittingRef.current = true;
let didSubmit = false;
const parentId = replyTarget?.id || null;
const previous = comments;
const previousCount = count;
const { tempId } = insertOptimisticComment(trimmed, parentId);
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
didSubmit = true;
} catch (err) {
setComments(previous);
updateCount(previousCount);
setError(err instanceof Error ? err.message : "Failed to post comment.");
} finally {
setSubmitting(false);
submittingRef.current = false;
if (didSubmit) {
draftRef.current = "";
if (textareaRef.current) {
textareaRef.current.value = "";
}
}
}
};

const handleDelete = async (commentId: string) => {
if (!confirm("Delete this comment? This removes it from the thread.")) return;
const response = await fetch(`/api/comments/${commentId}`, {
method: "DELETE",
credentials: "include",
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
setError(`Failed to delete comment: ${message}`);
return;
}

let removedCount = 0;
setComments((prev) => {
const result = removeById(prev, commentId);
removedCount = result.removedCount;
return result.nextItems;
});
if (removedCount > 0) {
setCount((prev) => {
const next = Math.max(0, prev - removedCount);
onCountChange?.(next);
return next;
});
}

await fetchComments(true);
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
// Focus the textarea after setting reply target
setTimeout(() => {
textareaRef.current?.focus();
if (process.env.NODE_ENV !== "production") {
console.debug("[composer]", { focused: document.activeElement === textareaRef.current });
}
}, 100);
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
const hasText = Boolean((textareaRef.current?.value ?? draftRef.current).trim()) || hasTextState;

return (
<Drawer
open={isOpen}
onOpenChange={handleDrawerChange}
side={drawerSide}
>
<div className="flex flex-col h-full">
{/* Header */}
<div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
<h2 className="text-lg font-semibold text-white">
Comments {count > 0 && `(${count})`}
</h2>
<button
type="button"
onClick={() => handleDrawerChange(false)}
className="text-muted hover:text-white transition-colors"
aria-label="Close comments"
>
✕
</button>
</div>

{/* Scrollable content area */}
<div
ref={scrollRef}
onScroll={handleScroll}
className="flex-1 overflow-y-auto p-4 pb-28 space-y-4"
style={{
overscrollBehavior: 'contain',
WebkitOverflowScrolling: 'touch'
}}
>
{loading && status === "loading" && comments.length === 0 ? (
<div className="space-y-4">{skeletons}</div>
) : error ? (
<div className="text-center py-8">
<p className="text-sm text-red-400 mb-3">{error}</p>
<button
type="button"
onClick={() => fetchComments(true)}
className="text-xs text-accent hover:underline"
>
Retry
</button>
</div>
) : comments.length === 0 ? (
<div className="text-center py-12 text-muted">
<p className="mb-2">No comments yet.</p>
{canPost && <p className="text-xs">Be the first to comment!</p>}
</div>
) : (
<>
{comments.map((comment) => renderComment(comment, 0))}
{showJump && (
<button
type="button"
onClick={scrollToBottom}
className="fixed bottom-24 right-8 bg-accent text-black px-4 py-2 rounded-full shadow-lg hover:scale-105 transition-transform text-sm font-medium"
>
↓ New comment
</button>
)}
</>
)}
</div>

{/* Composer - fixed at bottom */}
<div className="sticky bottom-0 z-20 border-t border-[var(--border)] p-4 bg-[var(--surface)]">
{replyTarget && (
<div className="flex items-center justify-between mb-2 p-2 bg-white/5 rounded-lg">
<span className="text-xs text-muted">
Replying to <span className="text-accent">{replyTarget.name}</span>
</span>
<button
type="button"
onClick={() => setReplyTarget(null)}
className="text-muted hover:text-white text-xs"
>
Cancel
</button>
</div>
)}
<div className="space-y-2">
<textarea
ref={textareaRef}
defaultValue=""
onChange={(e) => {
draftRef.current = e.target.value;
setError(null);
const nextHasText = Boolean(e.target.value.trim());
setHasTextState((prev) => (prev === nextHasText ? prev : nextHasText));
}}
onKeyDown={(e) => {
if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
e.preventDefault();
handleSubmit();
}
}}
placeholder={composerPlaceholder}
disabled={submitting || !canPost}
className="w-full bg-white/5 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
rows={3}
style={{
touchAction: 'manipulation'
}}
inputMode="text"
autoCapitalize="sentences"
autoCorrect="on"
spellCheck={true}
/>
<div className="flex items-center justify-between gap-3 pr-16">
<div className="text-xs text-muted">
{canPost ? (
<span>Tip: Press {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to post</span>
) : (
<span>You must be a member to comment.</span>
)}
</div>
<button
type="button"
onClick={handleSubmit}
disabled={!canPost || submitting || !hasText}
className="px-4 py-2 bg-accent text-black rounded-lg font-medium text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
>
{submitting ? "Posting..." : "Post"}
</button>
</div>
</div>
</div>
</div>
</Drawer>
);
}