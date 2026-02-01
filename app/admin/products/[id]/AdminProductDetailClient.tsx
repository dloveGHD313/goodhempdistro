"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category_id: string | null;
  active: boolean;
  product_type?: string;
  coa_url?: string | null;
  coa_object_path?: string | null;
  delta8_disclaimer_ack?: boolean;
  status?: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
};

type Props = {
  productId: string;
  initialProduct: Product;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

const statusLabel = (status?: string | null) => {
  switch (status) {
    case "draft": return "Draft";
    case "pending_review": return "Pending Review";
    case "approved": return "Approved";
    case "rejected": return "Rejected";
    default: return status || "—";
  }
};

export default function AdminProductDetailClient({ productId, initialProduct }: Props) {
  const router = useRouter();
  const [product, setProduct] = useState(initialProduct);
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coaUrl =
    product.coa_url?.trim() ||
    (product.coa_object_path && typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/coas/${product.coa_object_path.replace(/^\/+/, "").replace(/^coas\//, "")}`
      : null);

  const handleApprove = async () => {
    setLoading("approve");
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Failed to approve");
        setLoading(null);
        return;
      }
      setProduct((p) => ({ ...p, status: "approved", active: true }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError("Rejection reason is required");
      return;
    }
    setLoading("reject");
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || "Failed to reject");
        setLoading(null);
        return;
      }
      setProduct((p) => ({ ...p, status: "rejected", active: false }));
      setShowReject(false);
      setRejectReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  };

  const handleToggleActive = async () => {
    setLoading("active");
    setError(null);
    try {
      const res = await fetch(`/api/vendors/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: product.name,
          description: product.description,
          price_cents: product.price_cents,
          category_id: product.category_id,
          active: !product.active,
          product_type: product.product_type,
          coa_url: product.coa_url,
          coa_object_path: product.coa_object_path,
          delta8_disclaimer_ack: product.delta8_disclaimer_ack,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to update");
        setLoading(null);
        return;
      }
      setProduct((p) => ({ ...p, active: !p.active }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    setLoading("delete");
    setError(null);
    try {
      const res = await fetch(`/api/vendors/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Failed to delete");
        setLoading(null);
        return;
      }
      router.push("/admin/products");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setLoading(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-accent">Product Moderation</h1>
        <Link href="/admin/products" className="btn-secondary">
          ← Back to list
        </Link>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      <div className="surface-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{product.name}</h2>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-1 rounded text-xs bg-gray-600 text-gray-200">
              {statusLabel(product.status)}
            </span>
            {product.active && (
              <span className="px-2 py-1 rounded text-xs bg-green-600/30 text-green-300">Active</span>
            )}
          </div>
        </div>
        {product.description && (
          <p className="text-muted">{product.description}</p>
        )}
        <dl className="grid gap-2 text-sm">
          <div><dt className="text-muted">Price</dt><dd>${((product.price_cents || 0) / 100).toFixed(2)}</dd></div>
          <div><dt className="text-muted">Submitted</dt><dd>{formatDate(product.submitted_at)}</dd></div>
          <div><dt className="text-muted">Reviewed</dt><dd>{formatDate(product.reviewed_at)}</dd></div>
          {product.rejection_reason && (
            <div><dt className="text-muted">Rejection reason</dt><dd className="text-red-300">{product.rejection_reason}</dd></div>
          )}
          {coaUrl && (
            <div>
              <dt className="text-muted">COA</dt>
              <dd><a href={coaUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">View COA →</a></dd>
            </div>
          )}
          {product.product_type && (
            <div><dt className="text-muted">Product type</dt><dd>{product.product_type}</dd></div>
          )}
        </dl>
      </div>

      <div className="surface-card p-6">
        <h3 className="font-semibold mb-4">Actions</h3>
        <div className="flex flex-wrap gap-3">
          {product.status === "pending_review" && (
            <>
              <button
                type="button"
                onClick={handleApprove}
                disabled={loading !== null}
                className="btn-primary disabled:opacity-50"
              >
                {loading === "approve" ? "Processing..." : "Approve"}
              </button>
              {!showReject ? (
                <button
                  type="button"
                  onClick={() => setShowReject(true)}
                  disabled={loading !== null}
                  className="btn-secondary disabled:opacity-50"
                >
                  Reject
                </button>
              ) : (
                <div className="flex flex-col gap-2 w-full max-w-md">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason (required)"
                    rows={3}
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={loading !== null || !rejectReason.trim()}
                      className="btn-secondary bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    >
                      {loading === "reject" ? "Processing..." : "Confirm Reject"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowReject(false); setRejectReason(""); }}
                      disabled={loading !== null}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {product.status === "approved" && (
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={loading !== null}
              className="btn-secondary disabled:opacity-50"
            >
              {loading === "active" ? "Updating..." : product.active ? "Set Inactive" : "Set Active"}
            </button>
          )}
          <Link href={`/vendors/products/${productId}/edit`} className="btn-secondary">
            Edit in vendor form
          </Link>
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading !== null}
              className="btn-secondary text-red-400 hover:bg-red-900/30"
            >
              Delete product
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted">Delete this product?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading !== null}
                className="btn-secondary bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {loading === "delete" ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading !== null}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
