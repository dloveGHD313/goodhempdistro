"use client";

import { useEffect, useState } from "react";

type PayoutRow = {
  id: string;
  affiliate_id: string;
  amount_cents: number;
  stripe_transfer_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  affiliate_code: string | null;
  stripe_account_id: string | null;
};

export default function AffiliatePayoutsClient() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPayouts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/affiliates/payouts", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load");
        setPayouts([]);
        return;
      }
      setPayouts(data.payouts ?? []);
    } catch {
      setError("Failed to load");
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  const handleApprove = async (id: string) => {
    setApproving(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/affiliates/payouts/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Approve failed");
        return;
      }
      fetchPayouts();
    } catch {
      setError("Approve failed");
    } finally {
      setApproving(null);
    }
  };

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {payouts.length === 0 ? (
        <p className="text-muted">No payouts.</p>
      ) : (
        <div className="overflow-x-auto surface-card p-6">
          <table className="w-full text-left">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="pb-2 font-semibold text-muted">Date</th>
                <th className="pb-2 font-semibold text-muted">Code</th>
                <th className="pb-2 font-semibold text-muted">Amount</th>
                <th className="pb-2 font-semibold text-muted">Status</th>
                <th className="pb-2 font-semibold text-muted">Stripe</th>
                <th className="pb-2 font-semibold text-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)]/60">
                  <td className="py-2 text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="py-2 font-mono text-sm">{p.affiliate_code ?? "—"}</td>
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
                  <td className="py-2 text-muted text-xs">
                    {p.stripe_transfer_id ? `tr_…${p.stripe_transfer_id.slice(-8)}` : p.stripe_account_id ? "—" : "No Connect"}
                  </td>
                  <td className="py-2">
                    {p.status === "requested" && p.stripe_account_id && (
                      <button
                        type="button"
                        onClick={() => handleApprove(p.id)}
                        disabled={approving === p.id}
                        className="btn-primary text-sm disabled:opacity-50"
                      >
                        {approving === p.id ? "Approving…" : "Approve"}
                      </button>
                    )}
                    {p.status === "requested" && !p.stripe_account_id && (
                      <span className="text-amber-400 text-sm">Connect required</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
