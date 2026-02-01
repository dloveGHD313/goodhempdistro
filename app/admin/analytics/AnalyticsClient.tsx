"use client";

import { useEffect, useState } from "react";

type Overview = {
  gmv_cents: number;
  platform_revenue_cents: number;
  orders_count: number;
  aov_cents: number;
};

type SeriesPoint = { date: string; gmv_cents: number; fee_cents: number; count: number };

type TopVendor = { vendor_user_id: string; business_name: string; gmv_cents: number; fee_cents: number };

type TopItem = { item_id: string; gmv_cents: number };

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function AnalyticsClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [topVendors, setTopVendors] = useState<TopVendor[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [oRes, sRes, vRes, iRes] = await Promise.all([
          fetch("/api/admin/analytics/overview", { cache: "no-store", credentials: "include" }),
          fetch("/api/admin/analytics/timeseries?bucket=daily", { cache: "no-store", credentials: "include" }),
          fetch("/api/admin/analytics/top-vendors", { cache: "no-store", credentials: "include" }),
          fetch("/api/admin/analytics/top-items?type=product", { cache: "no-store", credentials: "include" }),
        ]);

        const oJson = await oRes.json();
        const sJson = await sRes.json();
        const vJson = await vRes.json();
        const iJson = await iRes.json();

        if (oJson.ok) setOverview(oJson);
        if (sJson.ok) setSeries(sJson.series || []);
        if (vJson.ok) setTopVendors(vJson.data || []);
        if (iJson.ok) setTopItems(iJson.data || []);

        if (!oRes.ok) setError(oJson?.error || "Failed to load overview");
      } catch {
        setError("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  if (loading) return <p className="text-muted">Loading analytics…</p>;
  if (error) return <div className="bg-red-900/30 border border-red-600 rounded p-4 text-red-400">{error}</div>;

  return (
    <div className="space-y-8">
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="surface-card p-4">
            <div className="text-sm text-muted">GMV</div>
            <div className="text-2xl font-bold text-accent">{formatCents(overview.gmv_cents)}</div>
          </div>
          <div className="surface-card p-4">
            <div className="text-sm text-muted">Platform revenue</div>
            <div className="text-2xl font-bold">{formatCents(overview.platform_revenue_cents)}</div>
          </div>
          <div className="surface-card p-4">
            <div className="text-sm text-muted">Orders</div>
            <div className="text-2xl font-bold">{overview.orders_count}</div>
          </div>
          <div className="surface-card p-4">
            <div className="text-sm text-muted">AOV</div>
            <div className="text-2xl font-bold">{formatCents(overview.aov_cents)}</div>
          </div>
        </div>
      )}

      {series.length > 0 && (
        <div className="surface-card p-6">
          <h2 className="text-xl font-semibold mb-4">Time series (daily)</h2>
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-600 rounded overflow-hidden">
              <thead className="bg-gray-800 text-left">
                <tr>
                  <th className="p-3 text-gray-300 font-medium">Date</th>
                  <th className="p-3 text-gray-300 font-medium">GMV</th>
                  <th className="p-3 text-gray-300 font-medium">Fees</th>
                  <th className="p-3 text-gray-300 font-medium">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {series.slice(-30).map((row) => (
                  <tr key={row.date} className="bg-gray-800/30">
                    <td className="p-3 text-gray-300">{row.date}</td>
                    <td className="p-3">{formatCents(row.gmv_cents)}</td>
                    <td className="p-3">{formatCents(row.fee_cents)}</td>
                    <td className="p-3">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {topVendors.length > 0 && (
        <div className="surface-card p-6">
          <h2 className="text-xl font-semibold mb-4">Top vendors by GMV</h2>
          <table className="w-full border border-gray-600 rounded overflow-hidden">
            <thead className="bg-gray-800 text-left">
              <tr>
                <th className="p-3 text-gray-300 font-medium">Vendor</th>
                <th className="p-3 text-gray-300 font-medium">GMV</th>
                <th className="p-3 text-gray-300 font-medium">Fees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {topVendors.map((row) => (
                <tr key={row.vendor_user_id} className="bg-gray-800/30">
                  <td className="p-3 text-gray-300">{row.business_name}</td>
                  <td className="p-3">{formatCents(row.gmv_cents)}</td>
                  <td className="p-3">{formatCents(row.fee_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {topItems.length > 0 && (
        <div className="surface-card p-6">
          <h2 className="text-xl font-semibold mb-4">Top products by GMV</h2>
          <table className="w-full border border-gray-600 rounded overflow-hidden">
            <thead className="bg-gray-800 text-left">
              <tr>
                <th className="p-3 text-gray-300 font-medium">Product ID</th>
                <th className="p-3 text-gray-300 font-medium">GMV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {topItems.map((row) => (
                <tr key={row.item_id} className="bg-gray-800/30">
                  <td className="p-3 font-mono text-sm text-gray-300">{row.item_id.slice(0, 8)}…</td>
                  <td className="p-3">{formatCents(row.gmv_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!overview && !error && <p className="text-muted">No paid orders yet. Overview and charts will appear when orders are paid.</p>}
    </div>
  );
}
