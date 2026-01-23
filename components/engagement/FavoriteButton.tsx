"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import useAuthUser from "./useAuthUser";

type Props = {
  entityType: "vendor" | "product" | "service" | "event";
  entityId: string;
  size?: "sm" | "md";
  initialFavorited?: boolean;
  className?: string;
};

export default function FavoriteButton({
  entityType,
  entityId,
  size = "sm",
  initialFavorited,
  className = "",
}: Props) {
  const { userId, loading } = useAuthUser();
  const [favorited, setFavorited] = useState(initialFavorited ?? false);
  const [saving, setSaving] = useState(false);
  const pathname = usePathname();
  const loginHref = `/login?redirect=${encodeURIComponent(pathname || "/")}`;

  useEffect(() => {
    if (initialFavorited !== undefined) {
      setFavorited(initialFavorited);
    }
  }, [initialFavorited]);

  useEffect(() => {
    if (initialFavorited !== undefined || loading || !userId) return;
    fetch(`/api/favorites?entity_type=${entityType}&entity_ids=${entityId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const exists = data?.favorites?.some((fav: any) => fav.entity_id === entityId);
        setFavorited(!!exists);
      })
      .catch(() => {
        // ignore
      });
  }, [entityType, entityId, initialFavorited, loading, userId]);

  const handleToggle = async () => {
    if (loading) return;
    if (!userId) {
      window.location.href = loginHref;
      return;
    }

    setSaving(true);
    try {
      if (!favorited) {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
        });
        if (res.ok) {
          setFavorited(true);
        }
      } else {
        const res = await fetch("/api/favorites", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
        });
        if (res.ok) {
          setFavorited(false);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const sizeClasses = size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs";

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={saving}
      className={`border border-[var(--border)] rounded-full ${sizeClasses} ${
        favorited ? "bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]" : "text-muted"
      } ${saving ? "opacity-60" : ""} ${className}`}
      aria-pressed={favorited}
    >
      {favorited ? "★ Saved" : "☆ Save"}
    </button>
  );
}
