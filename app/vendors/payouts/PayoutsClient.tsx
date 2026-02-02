"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Status = {
  connected: boolean;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
};

export default function PayoutsClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vendors/connect/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to load status");
        setStatus(null);
        return;
      }
      setStatus({
        connected: data.connected ?? false,
        stripe_account_id: data.stripe_account_id ?? null,
        charges_enabled: data.charges_enabled ?? false,
        payouts_enabled: data.payouts_enabled ?? false,
      });
    } catch {
      setError("Failed to load status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      if (status?.stripe_account_id) {
        const res = await fetch("/api/vendors/connect/onboard-link", { method: "POST" });
        const linkData = await res.json();
        if (!res.ok || !linkData?.url) {
          const ref = linkData?.requestId ? ` Reference: ${linkData.requestId}` : "";
          setError((linkData?.error || "Failed to get onboarding link") + ref);
          setConnecting(false);
          return;
        }
        window.location.href = linkData.url;
        return;
      }
      const createRes = await fetch("/api/vendors/connect/create-account", { method: "POST" });
      const createData = await createRes.json();
      if (!createRes.ok) {
        const ref = createData?.requestId ? ` Reference: ${createData.requestId}` : "";
        setError((createData?.error || "Failed to create account") + ref);
        setConnecting(false);
        return;
      }
      const linkRes = await fetch("/api/vendors/connect/onboard-link", { method: "POST" });
      const linkData = await linkRes.json();
      if (!linkRes.ok || !linkData?.url) {
        const ref = linkData?.requestId ? ` Reference: ${linkData.requestId}` : "";
        setError((linkData?.error || "Failed to get onboarding link") + ref);
        setConnecting(false);
        return;
      }
      window.location.href = linkData.url;
    } catch {
      setError("Onboarding failed. Reference: unknown");
      setConnecting(false);
    }
  };

  if (loading) {
    return <p className="text-muted">Loading payout status…</p>;
  }

  return (
    <div className="surface-card p-6 space-y-6">
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {status?.connected ? (
        <>
          <div className="flex items-center gap-3 text-green-400">
            <span className="font-semibold">Stripe Connect connected</span>
          </div>
          <ul className="text-sm text-muted space-y-1">
            <li>Charges enabled: {status.charges_enabled ? "Yes" : "No"}</li>
            <li>Payouts enabled: {status.payouts_enabled ? "Yes" : "No"}</li>
          </ul>
          {(!status.charges_enabled || !status.payouts_enabled) && (
            <p className="text-yellow-400 text-sm">
              Complete onboarding in Stripe to enable payouts. You can open the link again to continue.
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="btn-secondary text-sm"
            >
              {connecting ? "Redirecting…" : "Update or complete onboarding"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted">
            Connect your Stripe account to receive payouts (e.g. vendor referral rewards). Stripe will guide you through verification.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="btn-primary disabled:opacity-50"
          >
            {connecting ? "Redirecting…" : "Connect with Stripe"}
          </button>
        </>
      )}

      <div className="pt-4 border-t border-[var(--border)]">
        <Link href="/vendors/dashboard" className="text-accent text-sm hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
