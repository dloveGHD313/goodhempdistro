"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type LedgerEntry = {
  id: string;
  amount_cents: number;
  status: string;
  order_id: string | null;
  metadata: unknown;
  created_at: string;
};

type Payout = {
  id: string;
  amount_cents: number;
  status: string;
  stripe_transfer_id: string | null;
  created_at: string;
};

type ConnectStatus = {
  connected: boolean;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
};

type Props = { affiliateCode: string | null };

export default function AffiliatePortalClient({ affiliateCode }: Props) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [available_cents, setAvailableCents] = useState(0);
  const [total_earned_cents, setTotalEarnedCents] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [connect, setConnect] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestAmount, setRequestAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const referralUrl =
    typeof window !== "undefined" && affiliateCode
      ? `${window.location.origin}/r/${affiliateCode}`
      : affiliateCode
        ? `/r/${affiliateCode}`
        : "";

  const copyReferralLink = useCallback(() => {
    if (!referralUrl) return;
    const url = referralUrl.startsWith("http") ? referralUrl : `${typeof window !== "undefined" ? window.location.origin : ""}${referralUrl}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setError("Could not copy")
    );
  }, [referralUrl]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ledgerRes, balanceRes, connectRes] = await Promise.all([
        fetch("/api/affiliates/ledger", { cache: "no-store" }),
        fetch("/api/affiliates/balance", { cache: "no-store" }),
        fetch("/api/affiliates/connect/status", { cache: "no-store" }),
      ]);

      const ledger = ledgerRes.ok ? await ledgerRes.json() : { entries: [] };
      const balance = balanceRes.ok ? await balanceRes.json() : { available_cents: 0, total_earned_cents: 0 };
      const conn = connectRes.ok ? await connectRes.json() : { connected: false };

      setEntries(ledger.entries ?? []);
      setAvailableCents(balance.available_cents ?? 0);
      setTotalEarnedCents(balance.total_earned_cents ?? 0);
      setConnect(conn.connected ? conn : null);

      const payoutsRes = await fetch("/api/affiliates/payouts", { cache: "no-store" });
      if (payoutsRes.ok) {
        const p = await payoutsRes.json();
        setPayouts(p.payouts ?? []);
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleRequestPayout = async () => {
    const cents = Math.floor(parseFloat(requestAmount || "0") * 100);
    if (cents <= 0 || cents > available_cents) {
      setError(`Enter an amount between $0.01 and $${(available_cents / 100).toFixed(2)}`);
      return;
    }
    setRequesting(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliates/payouts/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: cents }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      setRequestAmount("");
      fetchAll();
    } catch {
      setError("Request failed");
    } finally {
      setRequesting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      let res = await fetch("/api/affiliates/connect/create-account", { method: "POST" });
      const createData = await res.json();
      if (!res.ok) {
        setError(createData?.error || "Failed to create account");
        setConnecting(false);
        return;
      }
      res = await fetch("/api/affiliates/connect/onboard-link", { method: "POST" });
      const linkData = await res.json();
      if (!res.ok || !linkData?.url) {
        setError(linkData?.error || "Failed to get link");
        setConnecting(false);
        return;
      }
      window.location.href = linkData.url;
    } catch {
      setError("Something went wrong");
      setConnecting(false);
    }
  };

  if (loading) {
    return <p className="text-muted">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {affiliateCode && (
        <div className="surface-card p-6">
          <h2 className="text-xl font-bold mb-2">Referral link</h2>
          <p className="text-sm text-muted mb-2">Share this link to earn when others sign up or purchase.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 truncate px-3 py-2 bg-[var(--surface)]/70 border border-[var(--border)] rounded text-sm">
              {typeof window !== "undefined" ? window.location.origin : ""}/r/{affiliateCode}
            </code>
            <button
              type="button"
              onClick={copyReferralLink}
              className="btn-secondary whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="surface-card p-6">
          <h2 className="text-xl font-bold mb-2">Overview</h2>
          <p className="text-sm text-muted">
            Track your referrals, earnings, and payouts in one place.
          </p>
          <div className="mt-4">
            <label className="block text-sm text-muted mb-2">Your referral link</label>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                readOnly
                value={referralUrl ? (referralUrl.startsWith("http") ? referralUrl : `${typeof window !== "undefined" ? window.location.origin : ""}${referralUrl}`) : ""}
                className="w-full px-3 py-2 bg-[var(--surface)]/70 border border-[var(--border)] rounded text-white"
              />
              <button
                type="button"
                onClick={copyReferralLink}
                className="btn-secondary w-fit text-sm"
                disabled={!referralUrl}
              >
                {copied ? "Copied" : "Copy referral link"}
              </button>
              <p className="text-xs text-muted">
                Share this link to earn rewards on qualifying subscriptions.
              </p>
            </div>
          </div>
        </div>
        <div className="surface-card p-6">
          <h2 className="text-xl font-bold mb-2">Available balance</h2>
          <p className="text-3xl font-bold text-accent">${(available_cents / 100).toFixed(2)}</p>
          <p className="text-sm text-muted mt-1">Total earned: ${(total_earned_cents / 100).toFixed(2)}</p>
        </div>
        <div className="surface-card p-6">
          <h2 className="text-xl font-bold mb-2">Basic stats</h2>
          <p className="text-sm text-muted">Referral and conversion stats are coming next.</p>
        </div>
        <div className="surface-card p-6">
          <h2 className="text-xl font-bold mb-2">Request payout</h2>
          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-sm text-muted mb-1">Amount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                className="w-32 px-3 py-2 bg-[var(--surface)]/70 border border-[var(--border)] rounded text-white"
              />
            </div>
            <button
              type="button"
              onClick={handleRequestPayout}
              disabled={requesting || available_cents <= 0}
              className="btn-primary disabled:opacity-50"
            >
              {requesting ? "Requesting…" : "Request"}
            </button>
          </div>
          <p className="text-xs text-muted mt-2">Admin will approve and send via Stripe Connect.</p>
        </div>
      </div>

      <div className="surface-card p-6">
        <h2 className="text-xl font-bold mb-4">Stripe Connect</h2>
        {connect?.connected ? (
          <div>
            <p className="text-green-400 font-semibold">Connected</p>
            <ul className="text-sm text-muted mt-1">
              <li>Charges enabled: {connect.charges_enabled ? "Yes" : "No"}</li>
              <li>Payouts enabled: {connect.payouts_enabled ? "Yes" : "No"}</li>
            </ul>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="btn-secondary mt-3 text-sm"
            >
              {connecting ? "Redirecting…" : "Update onboarding"}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-muted mb-3">Connect Stripe to receive payouts when admin approves.</p>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="btn-primary disabled:opacity-50"
            >
              {connecting ? "Redirecting…" : "Connect with Stripe"}
            </button>
          </div>
        )}
      </div>

      {payouts.length > 0 && (
        <div className="surface-card p-6">
          <h2 className="text-xl font-bold mb-4">Payout history</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="pb-2 font-semibold text-muted">Date</th>
                  <th className="pb-2 font-semibold text-muted">Amount</th>
                  <th className="pb-2 font-semibold text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)]/60">
                    <td className="py-2 text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="py-2 font-semibold">${(p.amount_cents / 100).toFixed(2)}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          p.status === "paid"
                            ? "bg-green-500/20 text-green-400"
                            : p.status === "requested"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="surface-card p-6">
        <h2 className="text-xl font-bold mb-4">Earnings (ledger)</h2>
        {entries.length === 0 ? (
          <p className="text-muted">
            No earnings yet. Share your referral link to start earning. When referrals convert, entries will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="pb-2 font-semibold text-muted">Date</th>
                  <th className="pb-2 font-semibold text-muted">Amount</th>
                  <th className="pb-2 font-semibold text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--border)]/60">
                    <td className="py-2 text-muted">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="py-2 font-semibold">${(e.amount_cents / 100).toFixed(2)}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          e.status === "paid"
                            ? "bg-green-500/20 text-green-400"
                            : e.status === "available"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-[var(--border)]">
        <Link href="/affiliate" className="text-accent text-sm hover:underline">
          ← Back to Affiliate (referral link)
        </Link>
      </div>
    </div>
  );
}
