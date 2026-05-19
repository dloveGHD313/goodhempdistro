"use client";

import { useState } from "react";

/**
 * Click → POST /api/vendors/connect/manage-link → window.location to the
 * Stripe-hosted Express dashboard URL Stripe just minted (one-time, expires
 * in ~5 min). The Express dashboard is where vendors update bank account,
 * change payout schedule, view detailed payout history, etc. — all UX Stripe
 * provides natively.
 */
export default function ManageAccountButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vendors/connect/manage-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) {
        setError(data?.error || "Could not open Stripe dashboard. Try again.");
        setLoading(false);
        return;
      }
      // Full navigation rather than new tab — Stripe expects the user there now.
      window.location.assign(data.url);
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#3CB97A] px-4 py-2 text-sm font-semibold text-[#0D1512] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Opening Stripe…" : "Manage account"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
