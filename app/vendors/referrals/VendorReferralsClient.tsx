"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

type LedgerEntry = {
  id: string;
  amount_cents: number;
  status: string;
  vendor_referral_id: string | null;
  order_id: string | null;
  created_at: string;
};

type Payout = {
  id: string;
  amount_cents: number;
  status: string;
  stripe_transfer_id: string | null;
  created_at: string;
};

export default function VendorReferralsClient() {
  const [referralCode, setReferralCode] = useState<string>("");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [available_cents, setAvailableCents] = useState(0);
  const [total_earned_cents, setTotalEarnedCents] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestAmount, setRequestAmount] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const referralLink = referralCode ? `${siteUrl}/vr/${referralCode}` : "";

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [codeRes, ledgerRes, balanceRes, payoutsRes] = await Promise.all([
        fetch("/api/vendors/referrals/code", { cache: "no-store" }),
        fetch("/api/vendors/referrals/ledger", { cache: "no-store" }),
        fetch("/api/vendors/referrals/balance", { cache: "no-store" }),
        fetch("/api/vendors/referrals/payouts", { cache: "no-store" }),
      ]);

      const codeData = codeRes.ok ? await codeRes.json() : {};
      const ledgerData = ledgerRes.ok ? await ledgerRes.json() : { entries: [] };
      const balanceData = balanceRes.ok ? await balanceRes.json() : { available_cents: 0, total_earned_cents: 0 };
      const payoutsData = payoutsRes.ok ? await payoutsRes.json() : { payouts: [] };

      setReferralCode(codeData.referral_code ?? "");
      setEntries(ledgerData.entries ?? []);
      setAvailableCents(balanceData.available_cents ?? 0);
      setTotalEarnedCents(balanceData.total_earned_cents ?? 0);
      setPayouts(payoutsData.payouts ?? []);
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
      const res = await fetch("/api/vendors/referrals/payouts/request", {
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

  const copyLink = () => {
    if (navigator.clipboard && referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

      <div className="surface-card p-6">
        <h2 className="text-xl font-bold mb-2">Your referral link</h2>
        <p className="text-muted text-sm mb-3">Share with other vendors. You earn when they join and make their first sale.</p>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="flex-1 px-4 py-2 bg-[var(--surface)]/70 border border-[var(--border)] rounded text-white"
          />
          <button type="button" onClick={copyLink} className="btn-secondary">
            {copied ? "✓ Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="surface-card p-6">
          <h2 className="text-xl font-bold mb-2">Available balance</h2>
          <p className="text-3xl font-bold text-accent">${(available_cents / 100).toFixed(2)}</p>
          <p className="text-sm text-muted mt-1">Total earned: ${(total_earned_cents / 100).toFixed(2)}</p>
        </div>
        <div className="surface-card p-6">
          <h2 className="text-xl font-bold mb-2">Request payout</h2>
          <p className="text-sm text-muted mb-2">Payouts go to your Stripe Connect account.</p>
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
          <Link href="/vendors/payouts" className="text-accent text-sm hover:underline mt-2 inline-block">
            Connect Stripe for payouts →
          </Link>
        </div>
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
                          p.status === "paid" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"
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
          <p className="text-muted">No earnings yet. Share your referral link.</p>
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
                          e.status === "paid" ? "bg-green-500/20 text-green-400" : e.status === "available" ? "bg-amber-500/20 text-amber-400" : "bg-gray-500/20 text-gray-400"
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
        <Link href="/vendors/dashboard" className="text-accent text-sm hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
