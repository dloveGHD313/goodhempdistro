"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  status: string;
  active?: boolean;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  vendor_id: string;
  owner_user_id: string;
  vendors: { business_name: string; owner_user_id: string } | null;
  profiles: { email?: string; display_name?: string } | null;
};

type Props = {
  initialProducts: Product[];
  initialError: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

function ageText(submittedAt?: string | null): string {
  if (!submittedAt) return "—";
  const d = new Date(submittedAt);
  if (Number.isNaN(d.getTime())) return "—";
  const now = Date.now();
  const ms = now - d.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor(ms / (60 * 1000));
  return `${mins}m`;
}

export default function ProductQueueClient({ initialProducts, initialError }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | "delete" | null>(null);
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p.id)));
  };

  const runBulk = async () => {
    if (bulkAction === "reject" && bulkRejectReason.trim().length < 5) {
      setError("Rejection reason must be at least 5 characters");
      return;
    }
    setBulkLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: bulkAction,
          productIds: Array.from(selected),
          reason: bulkAction === "reject" ? bulkRejectReason.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Bulk action failed");
        if (data?.invalid?.length) {
          setError(`${data.error} (${data.invalid.length} invalid)`);
        }
        setBulkLoading(false);
        return;
      }
      const failed = (data.results || []).filter((r: { status: string }) => r.status === "failed");
      if (failed.length > 0) {
        setError(`${failed.length} item(s) failed: ${failed.map((f: { error: string }) => f.error).join("; ")}`);
      }
      setSelected(new Set());
      setBulkAction(null);
      setBulkRejectReason("");
      setProducts((prev) => prev.filter((p) => !selected.has(p.id)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const vendorName = (p: Product) => p.vendors?.business_name || "N/A";

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {selected.size > 0 && (
        <div className="card-glass p-4 flex flex-wrap items-center gap-4">
          <span className="font-medium">{selected.size} selected</span>
          {!bulkAction ? (
            <>
              <button
                type="button"
                onClick={() => setBulkAction("approve")}
                className="btn-primary text-sm"
              >
                Approve selected
              </button>
              <button
                type="button"
                onClick={() => setBulkAction("reject")}
                className="btn-secondary text-sm"
              >
                Reject selected
              </button>
              <button
                type="button"
                onClick={() => setBulkAction("delete")}
                className="btn-secondary text-red-400 hover:bg-red-900/30 text-sm"
              >
                Delete selected
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="btn-secondary text-sm">
                Clear selection
              </button>
            </>
          ) : (
            <>
              {bulkAction === "reject" && (
                <textarea
                  value={bulkRejectReason}
                  onChange={(e) => setBulkRejectReason(e.target.value)}
                  placeholder="Rejection reason (required, min 5 chars)"
                  rows={2}
                  className="flex-1 min-w-[200px] px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white"
                />
              )}
              <button
                type="button"
                onClick={runBulk}
                disabled={bulkLoading || (bulkAction === "reject" && bulkRejectReason.trim().length < 5)}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {bulkLoading ? "Processing..." : `Confirm ${bulkAction}`}
              </button>
              <button
                type="button"
                onClick={() => { setBulkAction(null); setBulkRejectReason(""); }}
                disabled={bulkLoading}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <div className="card-glass p-8 text-center text-muted">
          No products pending review.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="pb-3 pr-2">
                  <input
                    type="checkbox"
                    checked={selected.size === products.length}
                    onChange={toggleSelectAll}
                    className="accent-accent"
                  />
                </th>
                <th className="pb-3 font-semibold text-muted">Product</th>
                <th className="pb-3 font-semibold text-muted">Vendor</th>
                <th className="pb-3 font-semibold text-muted">Submitted</th>
                <th className="pb-3 font-semibold text-muted">Age</th>
                <th className="pb-3 font-semibold text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)]">
                  <td className="py-3 pr-2">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="accent-accent"
                    />
                  </td>
                  <td className="py-3">
                    <Link href={`/admin/products/${p.id}`} className="text-accent hover:underline font-medium">
                      {p.name}
                    </Link>
                    <div className="text-sm text-muted">${((p.price_cents || 0) / 100).toFixed(2)}</div>
                  </td>
                  <td className="py-3 text-sm">{vendorName(p)}</td>
                  <td className="py-3 text-sm">{formatDate(p.submitted_at)}</td>
                  <td className="py-3 text-sm">{ageText(p.submitted_at)}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/products/${p.id}`} className="btn-secondary text-xs">
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          setLoading(p.id);
                          const res = await fetch(`/api/admin/products/${p.id}/approve`, { method: "POST" });
                          setLoading(null);
                          if (res.ok) {
                            setProducts((prev) => prev.filter((x) => x.id !== p.id));
                            router.refresh();
                          }
                        }}
                        disabled={loading !== null}
                        className="btn-primary text-xs disabled:opacity-50"
                      >
                        {loading === p.id ? "…" : "Approve"}
                      </button>
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="btn-secondary text-xs text-red-400"
                      >
                        Reject
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Delete this product?")) return;
                          setLoading(p.id);
                          const res = await fetch(`/api/vendors/products/${p.id}`, {
                            method: "DELETE",
                            credentials: "include",
                          });
                          setLoading(null);
                          if (res.ok) {
                            setProducts((prev) => prev.filter((x) => x.id !== p.id));
                            router.refresh();
                          }
                        }}
                        disabled={loading !== null}
                        className="btn-secondary text-xs text-red-400 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
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
