"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Success-page helper: after Stripe redirects back with ?session_id=, poll the
 * status endpoint (which verifies the session with Stripe itself) until the
 * founding number is assigned, then refresh the server-rendered page.
 */
export default function FoundingConfirm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch(`/api/founding/status?session_id=${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { status?: string; foundingNumber?: number | null };
        if (cancelled) return;
        if (data.status === "active" && data.foundingNumber) {
          router.replace("/founding?claimed=1");
          router.refresh();
          return;
        }
      } catch {
        // retry below
      }
      if (cancelled) return;
      if (tries >= 8) {
        setGaveUp(true);
        return;
      }
      setTimeout(() => !cancelled && setTries((t) => t + 1), 1500);
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [sessionId, tries, router]);

  return (
    <div className="card-glass border border-[var(--brand-lime)]/40 p-5 mb-6" data-testid="founding-confirming">
      {gaveUp ? (
        <>
          <p className="text-xl font-bold text-accent">Payment method saved.</p>
          <p className="text-sm text-muted mt-2">
            We&apos;re confirming your founding spot with Stripe — it can take a minute. Refresh this page shortly, or
            check your dashboard; your founding number will be waiting there.
          </p>
        </>
      ) : (
        <>
          <p className="text-xl font-bold text-accent">Confirming your founding spot…</p>
          <p className="text-sm text-muted mt-2">Stripe is finishing up. This usually takes a few seconds.</p>
        </>
      )}
    </div>
  );
}
