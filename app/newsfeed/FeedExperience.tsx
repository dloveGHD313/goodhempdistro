"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import useAuthUser from "@/components/engagement/useAuthUser";
import { getDisplayName } from "@/lib/identity";
import type { PostDTO } from "@/lib/types";
import CommentsDrawer from "@/components/comments/CommentsDrawer";
import PostComposer from "./PostComposer";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfileChip from "@/components/profile/ProfileChip";

type FeedPost = PostDTO;

const filters = [
  { id: "all", label: "All" },
  { id: "vendor", label: "Vendors" },
  { id: "community", label: "Community" },
  { id: "affiliate", label: "Affiliates" },
  { id: "driver", label: "Drivers" },
] as const;

const formatRelativeTime = (value: string) => {
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  if (Number.isNaN(delta)) return "Just now";
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

function FeedCard({ post }: { post: FeedPost }) {
  const displayName = getDisplayName({
    id: post.author_id,
    display_name: post.authorDisplayName ?? null,
  });
  return (
    <article className="feed-card hover-lift">
      <div className="flex items-center justify-between mb-3">
        <ProfileChip
          displayName={displayName}
          avatarUrl={post.authorAvatarUrl}
          role={post.author_role}
          tier={post.author_tier}
          isOfficial={post.is_admin_post}
          isVerifiedVendor={post.vendor_verified}
          badgeModel={post.authorBadgeModel ?? null}
        />
        <span className="text-xs text-muted">{formatRelativeTime(post.created_at)}</span>
      </div>
      <p className="text-white mb-4 whitespace-pre-line">{post.content}</p>

      {post.post_media.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 mb-4">
          {post.post_media.map((media) =>
            media.media_type === "image" ? (
              <img
                key={media.id}
                src={media.media_url}
                alt="Post media"
                className="feed-media"
                loading="lazy"
              />
            ) : (
              <video key={media.id} src={media.media_url} controls className="feed-media" />
            )
          )}
        </div>
      )}
    </article>
  );
}

export default function FeedExperience({ variant = "feed" }: { variant?: "feed" | "landing" }) {
  const { userId, loading: authLoading } = useAuthUser();
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleCta, setRoleCta] = useState<{ label: string; href: string } | null>(null);
  const [isPaidUser, setIsPaidUser] = useState(false);
  const [hasVerifiedVendors, setHasVerifiedVendors] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [commentsCount, setCommentsCount] = useState(0);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const emptyNotifiedRef = useRef(false);
  const nextCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  const dispatchMascotEvent = useCallback(
    (detail: {
      message: string;
      mood: "SUCCESS" | "ERROR" | "BLOCKED" | "CHILL";
      move?: "success_nod" | "error_shake" | "attention_pop";
    }) => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(new CustomEvent("ghd_mascot_event", { detail }));
    },
    []
  );

  const loadPosts = useCallback(
    async (cursor: string | null, mode: "reset" | "append") => {
      if (mode === "append") {
        if (!hasMoreRef.current || loadingMore) return;
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
        hasMoreRef.current = true;
        nextCursorRef.current = null;
      }

      try {
        const params = new URLSearchParams();
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/posts?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to load posts.");
        }
        const payload = await response.json();
        const items = (payload.posts || []) as FeedPost[];
        const nextCursor = payload.nextCursor || null;
        nextCursorRef.current = nextCursor;
        hasMoreRef.current = Boolean(nextCursor);

        setPosts((prev) => (mode === "append" ? [...prev, ...items] : items));
        setHasVerifiedVendors((prev) => prev || items.some((post) => post.vendor_verified));

        if (mode === "reset" && items.length === 0 && !emptyNotifiedRef.current) {
          emptyNotifiedRef.current = true;
          dispatchMascotEvent({
            message: "It's quiet right now.\nFirst posts always hit different.",
            mood: "CHILL",
            move: "attention_pop",
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load posts.";
        setError(message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [dispatchMascotEvent, loadingMore]
  );

  useEffect(() => {
    loadPosts(null, "reset");
  }, [loadPosts]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMoreRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && nextCursorRef.current) {
        loadPosts(nextCursorRef.current, "append");
      }
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadPosts]);

  useEffect(() => {
    if (!userId) {
      setRoleCta(null);
      setIsAdmin(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const resolveRole = async () => {
      const [vendorRes, driverRes, affiliateRes, consumerRes] = await Promise.allSettled([
        fetch("/api/vendor/status", { cache: "no-store" }),
        fetch("/api/driver/me", { cache: "no-store" }),
        supabase.from("affiliates").select("id").eq("user_id", userId).maybeSingle(),
        fetch("/api/consumer/status", { cache: "no-store" }),
      ]);
      const profileRes = await fetch("/api/profile", { cache: "no-store" }).catch(() => null);
      if (profileRes && profileRes.ok) {
        const profilePayload = await profileRes.json();
        const role = profilePayload?.profile?.role || null;
        setIsAdmin(role === "admin");
      }

      const vendorPayload =
        vendorRes.status === "fulfilled" && vendorRes.value.ok ? await vendorRes.value.json() : null;
      const driverPayload =
        driverRes.status === "fulfilled" && driverRes.value.ok ? await driverRes.value.json() : null;
      const affiliatePayload =
        affiliateRes.status === "fulfilled" ? affiliateRes.value.data : null;
      const consumerPayload =
        consumerRes.status === "fulfilled" && consumerRes.value.ok ? await consumerRes.value.json() : null;
      const vendorPaid = Boolean(
        vendorPayload?.isSubscribed && ["active", "trialing", "admin"].includes(vendorPayload?.subscriptionStatus)
      );
      const consumerPaid = Boolean(
        consumerPayload?.isSubscribed && ["active", "trialing", "admin"].includes(consumerPayload?.subscriptionStatus)
      );
      setIsPaidUser(vendorPaid || consumerPaid);

      if (vendorPayload?.isVendor || vendorPayload?.isAdmin) {
        setRoleCta({ label: "Vendor Dashboard", href: "/vendors/dashboard" });
        return;
      }
      if (driverPayload?.driver || driverPayload?.application) {
        setRoleCta({ label: "Driver Portal", href: "/driver/dashboard" });
        return;
      }
      if (affiliatePayload?.id) {
        setRoleCta({ label: "Affiliate", href: "/affiliate" });
        return;
      }
      setRoleCta({ label: "Account", href: "/account" });
    };

    resolveRole();
  }, [userId]);

  const handleDelete = async (postId: string) => {
    if (!userId) {
      dispatchMascotEvent({
        message: "Sign in to manage posts.",
        mood: "BLOCKED",
        move: "attention_pop",
      });
      return;
    }
    if (!confirm("Delete this post? This removes it from the feed.")) return;

    const prev = posts;
    setPosts((current) => current.filter((post) => post.id !== postId));
    try {
      const response = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete post.");
      }
      dispatchMascotEvent({
        message: "Post removed.",
        mood: "SUCCESS",
        move: "success_nod",
      });
    } catch {
      setPosts(prev);
      dispatchMascotEvent({
        message: "Delete failed.",
        mood: "ERROR",
        move: "error_shake",
      });
    }
  };

  const handleFlag = async (postId: string) => {
    if (!userId) {
      dispatchMascotEvent({
        message: "Sign in to report posts.",
        mood: "BLOCKED",
        move: "attention_pop",
      });
      return;
    }
    const reason = prompt("Report this post (optional reason):", "") || "";
    try {
      const response = await fetch(`/api/posts/${postId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        throw new Error("Failed to flag post.");
      }
      dispatchMascotEvent({
        message: "Reported. Thanks.",
        mood: "SUCCESS",
        move: "success_nod",
      });
    } catch {
      dispatchMascotEvent({
        message: "Report failed.",
        mood: "ERROR",
        move: "error_shake",
      });
    }
  };

  const filteredPosts = useMemo(() => {
    const sorted = [...posts].sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
      return String(b.created_at).localeCompare(String(a.created_at));
    });
    if (activeFilter === "all") return sorted;
    if (activeFilter === "vendor") return sorted.filter((post) => post.author_role === "vendor");
    if (activeFilter === "affiliate") return sorted.filter((post) => post.author_role === "affiliate");
    if (activeFilter === "driver") return sorted.filter((post) => post.author_role === "driver");
    return sorted.filter((post) => post.author_role === "consumer" || post.author_role === "admin");
  }, [activeFilter, posts]);

  const toggleLike = async (postId: string) => {
    if (!userId) {
      dispatchMascotEvent({
        message: "Sign in to like posts.",
        mood: "BLOCKED",
        move: "attention_pop",
      });
      return;
    }

    const current = posts.find((post) => post.id === postId);
    if (!current) return;

    const wasLiked = current.viewerHasLiked;
    const rollback = { ...current };
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const nextLiked = !post.viewerHasLiked;
        const nextCount = post.likeCount + (nextLiked ? 1 : -1);
        return { ...post, viewerHasLiked: nextLiked, likeCount: Math.max(nextCount, 0) };
      })
    );

    try {
      const method = wasLiked ? "DELETE" : "POST";
      const response = await fetch(`/api/posts/${postId}/likes`, { method });
      if (!response.ok) {
        throw new Error("Failed to update like.");
      }
      const payload = await response.json();
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, likeCount: payload.likeCount ?? post.likeCount } : post
        )
      );
      if (!wasLiked) {
        dispatchMascotEvent({
          message: "Like registered.",
          mood: "SUCCESS",
          move: "success_nod",
        });
      }
    } catch {
      setPosts((prev) => prev.map((post) => (post.id === rollback.id ? rollback : post)));
      dispatchMascotEvent({
        message: "Like failed. Want me to retry?",
        mood: "ERROR",
        move: "error_shake",
      });
    }
  };

  return (
    <section className="section-shell section-shell--tight feed-shell">
      <div className="feed-hero card-glass p-6 mb-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-muted mb-2">Good Hemp Social</p>
            <h1 className="text-3xl md:text-4xl font-bold text-accent mb-3">
              {variant === "landing" ? "Live Community Feed" : "Community News Feed"}
            </h1>
            <p className="text-muted max-w-2xl">
              Real-time drops, VIP vendors, and local events — all in one social-first marketplace feed.
            </p>
            <div className="live-indicator mt-4">
              <span className="live-dot" />
              Live updates enabled
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {authLoading ? null : userId ? (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => composerRef.current?.scrollIntoView({ behavior: "smooth" })}
                >
                  Create post
                </button>
                <Link href="/newsfeed" className="btn-secondary">
                  Go to feed
                </Link>
                {!isPaidUser && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() =>
                      dispatchMascotEvent({
                        message:
                          "If you want to earn with me, I’ll explain how it works.\nNo gimmicks. Just options.",
                        mood: "CHILL",
                        move: "attention_pop",
                      })
                    }
                  >
                    Earn with JAX
                  </button>
                )}
                {roleCta && (
                  <Link href={roleCta.href} className="btn-ghost">
                    {roleCta.label}
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href="/get-started" className="btn-primary">
                  Join
                </Link>
                <Link href="/login" className="btn-secondary">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8">
        <div className="space-y-6">
          {userId && (
            <div ref={composerRef}>
              <PostComposer
                userId={userId}
                onPostCreated={(post, firstPost) => {
                  setPosts((prev) => [
                    {
                      ...post,
                      likeCount: post.likeCount ?? 0,
                      viewerHasLiked: post.viewerHasLiked ?? false,
                    },
                    ...prev,
                  ]);
                  if (firstPost) {
                    emptyNotifiedRef.current = true;
                  }
                }}
                onMascotEvent={dispatchMascotEvent}
                isPaidUser={isPaidUser}
              />
            </div>
          )}

          <div className="feed-filter-bar">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`filter-chip ${activeFilter === filter.id ? "filter-chip--active" : ""}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="card-glass p-8 text-center">
              <p className="text-muted">Loading posts...</p>
            </div>
          )}

          {error && (
            <div className="card-glass p-8 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {!loading &&
            !error &&
            filteredPosts.map((post) => (
              <div key={post.id} className="space-y-3">
                <div className="relative">
                  <FeedCard post={post} />
                  {(userId || isAdmin) && (
                    <div className="absolute top-4 right-4">
                      <button
                        type="button"
                        className="btn-ghost text-lg leading-none"
                        onClick={() => setOpenMenuId((prev) => (prev === post.id ? null : post.id))}
                        aria-label="Post actions"
                      >
                        ⋯
                      </button>
                      {openMenuId === post.id && (
                        <div className="absolute right-0 mt-2 w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg z-20">
                          {userId && userId !== post.author_id && (
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm hover:bg-white/5"
                              onClick={() => {
                                setOpenMenuId(null);
                                handleFlag(post.id);
                              }}
                            >
                              Report post
                            </button>
                          )}
                          {userId && (userId === post.author_id || isAdmin) && (
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2 text-sm hover:bg-white/5"
                              onClick={() => {
                                setOpenMenuId(null);
                                handleDelete(post.id);
                              }}
                            >
                              Delete post
                            </button>
                          )}
                          {isAdmin && (
                            <a
                              href="/admin/moderation"
                              className="block px-4 py-2 text-sm hover:bg-white/5"
                            >
                              Moderation queue
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => toggleLike(post.id)}
                    className={`btn-ghost ${post.viewerHasLiked ? "text-accent" : ""}`}
                  >
                    {post.viewerHasLiked ? "♥ Liked" : "♡ Like"}
                  </button>
                  <span className="text-muted">{post.likeCount} likes</span>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setCommentsPostId(post.id);
                      setCommentsCount(post.commentCount ?? 0);
                    }}
                  >
                    Comments ({post.commentCount ?? 0})
                  </button>
                </div>
              </div>
            ))}

          {!loading && !error && filteredPosts.length === 0 && (
            <div className="card-glass p-8 text-center">
              <p className="text-muted">No posts in this channel yet.</p>
            </div>
          )}

          {!loading && !error && hasMoreRef.current && (
            <div className="text-center">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => loadPosts(nextCursorRef.current, "append")}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
          <div ref={sentinelRef} />
        </div>

        <aside className="space-y-6">
          <div className="card-glass p-6">
            <h2 className="text-lg font-semibold mb-3">VIP Spotlight (Placeholder)</h2>
            <ProfileCard
              displayName="VIP Spotlight"
              avatarUrl={null}
              bannerUrl={null}
              role="vendor"
              tier="none"
              isOfficial={false}
              isVerifiedVendor={false}
              placeholderText="VIP spotlight slots will appear here once verified profiles are available."
              compact
            />
          </div>

          <div className="card-glass p-6">
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <div className="grid gap-3">
              <Link href="/events" className="action-card">🎪 Explore events</Link>
              <Link href="/vendors" className="action-card">🏪 Meet vendors</Link>
              <Link href="/products" className="action-card">🛍️ Shop products</Link>
              <Link href="/logistics" className="action-card">🚚 Delivery network</Link>
            </div>
          </div>

          <div className="card-glass p-6">
            <h2 className="text-lg font-semibold mb-3">Compliance Status</h2>
            <p className="text-muted text-sm mb-4">
              {hasVerifiedVendors
                ? "Verified vendors are highlighted when subscriptions are active."
                : "Verified vendors will appear once subscriptions are active."}
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">COA Verified</span>
                <span className="info-pill">Off</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Vendor Reviews</span>
                <span className="info-pill">On</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Age Gate</span>
                <span className="info-pill">21+</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
      {commentsPostId && (
        <CommentsDrawer
          postId={commentsPostId}
          isOpen={Boolean(commentsPostId)}
          onClose={() => setCommentsPostId(null)}
          commentCount={commentsCount}
          isAdmin={isAdmin}
          onCountChange={(next) => {
            setCommentsCount(next);
            setPosts((prev) =>
              prev.map((post) =>
                post.id === commentsPostId ? { ...post, commentCount: next } : post
              )
            );
          }}
        />
      )}
    </section>
  );
}
