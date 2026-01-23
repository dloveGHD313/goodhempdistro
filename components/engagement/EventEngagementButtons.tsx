"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import useAuthUser from "./useAuthUser";

type Props = {
  eventId: string;
  className?: string;
};

type Counts = {
  interested: number;
  going: number;
};

export default function EventEngagementButtons({ eventId, className = "" }: Props) {
  const { userId, loading } = useAuthUser();
  const [status, setStatus] = useState<"interested" | "going" | null>(null);
  const [counts, setCounts] = useState<Counts>({ interested: 0, going: 0 });
  const [saving, setSaving] = useState(false);
  const pathname = usePathname();
  const loginHref = `/login?redirect=${encodeURIComponent(pathname || "/")}`;

  const loadCounts = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/engagement/counts`);
      if (!res.ok) return;
      const data = await res.json();
      setCounts({ interested: data.interested || 0, going: data.going || 0 });
    } catch {
      // ignore
    }
  };

  const loadStatus = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/engagement`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status || null);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadCounts();
  }, [eventId]);

  useEffect(() => {
    if (!loading) {
      loadStatus();
    }
  }, [eventId, loading, userId]);

  const handleToggle = async (nextStatus: "interested" | "going") => {
    if (loading) return;
    if (!userId) {
      window.location.href = loginHref;
      return;
    }

    setSaving(true);
    try {
      if (status === nextStatus) {
        const res = await fetch(`/api/events/${eventId}/engagement`, { method: "DELETE" });
        if (res.ok) {
          setStatus(null);
        }
      } else {
        const res = await fetch(`/api/events/${eventId}/engagement`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (res.ok) {
          setStatus(nextStatus);
        }
      }
      await loadCounts();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex flex-wrap gap-2 items-center ${className}`}>
      <button
        type="button"
        onClick={() => handleToggle("interested")}
        disabled={saving}
        className={`px-3 py-1 rounded-full text-xs border ${
          status === "interested"
            ? "bg-[var(--brand-orange)]/20 border-[var(--brand-orange)]/40 text-[var(--brand-orange)]"
            : "border-[var(--border)] text-muted"
        }`}
      >
        Interested ({counts.interested})
      </button>
      <button
        type="button"
        onClick={() => handleToggle("going")}
        disabled={saving}
        className={`px-3 py-1 rounded-full text-xs border ${
          status === "going"
            ? "bg-[var(--brand-lime)]/20 border-[var(--brand-lime)]/40 text-[var(--brand-lime)]"
            : "border-[var(--border)] text-muted"
        }`}
      >
        Going ({counts.going})
      </button>
    </div>
  );
}
