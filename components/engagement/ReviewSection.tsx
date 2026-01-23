"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import useAuthUser from "./useAuthUser";
import RatingBadge from "./RatingBadge";

type Review = {
  id: string;
  user_id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  created_at: string;
};

type Props = {
  entityType: "product" | "service" | "event" | "vendor";
  entityId: string;
  title?: string;
  className?: string;
};

export default function ReviewSection({
  entityType,
  entityId,
  title = "Reviews",
  className = "card-glass p-6",
}: Props) {
  const { userId, loading } = useAuthUser();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const pathname = usePathname();
  const loginHref = `/login?redirect=${encodeURIComponent(pathname || "/")}`;

  const summary = useMemo(() => {
    if (reviews.length === 0) return { avg: null, count: 0 };
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return { avg: total / reviews.length, count: reviews.length };
  }, [reviews]);

  const loadReviews = async () => {
    setLoadingReviews(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reviews?entity_type=${entityType}&entity_id=${entityId}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load reviews");
      }
      setReviews(data.reviews || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [entityType, entityId]);

  useEffect(() => {
    if (!userId) return;
    const existing = reviews.find((review) => review.user_id === userId);
    if (existing) {
      setRating(existing.rating);
      setReviewTitle(existing.title || "");
      setBody(existing.body || "");
    }
  }, [reviews, userId]);

  const handleSubmit = async () => {
    if (!userId || loading) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          rating,
          title: reviewTitle,
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save review");
      }
      await loadReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <RatingBadge average={summary.avg} count={summary.count} />
      </div>

      {loadingReviews ? (
        <p className="text-muted">Loading reviews...</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : reviews.length === 0 ? (
        <p className="text-muted">No reviews yet. Be the first to share feedback.</p>
      ) : (
        <div className="space-y-4 mb-6">
          {reviews.map((review) => (
            <div key={review.id} className="border border-[var(--border)] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--brand-lime)]">
                  ★ {review.rating.toFixed(1)}
                </span>
                <span className="text-xs text-muted">
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
              </div>
              {review.title && <div className="font-semibold mb-1">{review.title}</div>}
              {review.body && <p className="text-muted text-sm">{review.body}</p>}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-muted text-sm">Checking your sign-in status...</p>
        </div>
      ) : userId ? (
        <div className="border-t border-[var(--border)] pt-4">
          <h3 className="text-lg font-semibold mb-3">Write a review</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium mb-2">Rating</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} star{value > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Title (optional)</label>
              <input
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white"
                placeholder="Quick summary"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Review</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white"
              placeholder="Share your experience"
            />
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary disabled:opacity-60"
          >
            {saving ? "Saving..." : "Submit review"}
          </button>
        </div>
      ) : (
        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-muted text-sm">
            <a href={loginHref} className="text-accent hover:underline">
              Sign in
            </a>{" "}
            to leave a review.
          </p>
        </div>
      )}
    </div>
  );
}
