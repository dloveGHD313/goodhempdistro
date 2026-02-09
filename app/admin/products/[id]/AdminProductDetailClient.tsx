"use client";

import { useState, useEffect } from "react";
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

type COADocument = {
  id: string;
  storage_path: string;
  status: string;
  admin_note: string | null;
  uploaded_at: string;
} | null;

type COAData = {
  document: COADocument;
  coaRequired: boolean;
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
  const [showRejectCoa, setShowRejectCoa] = useState(false);
  const [coaRejectNote, setCoaRejectNote] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coaData, setCoaData] = useState<COAData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/products/${productId}/coa`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.document !== undefined) {
          setCoaData({ document: data.document, coaRequired: !!data.coaRequired });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [productId]);

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

  const handleViewCoa = async () => {
    setLoading("coa-view");
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/coa/view`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to get COA link");
        setLoading(null);
        return;
      }
      if (data.url) window.open(data.url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  };

  const handleVerifyCoa = async () => {
    setLoading("coa-verify");
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/coa/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "verified" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to verify COA");
        setLoading(null);
        return;
      }
      setCoaData((prev) =>
        prev?.document ? { ...prev, document: { ...prev.document!, status: "verified", admin_note: null } } : prev
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  };

  const handleRejectCoa = async () => {
    setLoading("coa-reject");
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/coa/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "rejected", admin_note: coaRejectNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to reject COA");
        setLoading(null);
        return;
      }
      setCoaData((prev) =>
        prev?.document
          ? { ...prev, document: { ...prev.document, status: "rejected", admin_note: coaRejectNote.trim() || null } }
          : prev
      );
      setShowRejectCoa(false);
      setCoaRejectNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  };

  const coaStatus = coaData?.document?.status ?? null;
  const coaRequired = coaData?.coaRequired ?? false;
  const canApprove = !coaRequired || coaStatus === "verified";

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
          {product.product_type && (
            <div><dt className="text-muted">Product type</dt><dd>{product.product_type}</dd></div>
          )}
        </dl>
      </div>

      {/* Phase 3C: COA review section */}
      <div className="surface-card p-6 space-y-4">
        <h3 className="font-semibold">COA</h3>
        {coaData === null ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-1 rounded text-xs ${
                  coaStatus === "verified"
                    ? "bg-green-600/30 text-green-300"
                    : coaStatus === "rejected"
                      ? "bg-red-600/30 text-red-300"
                      : "bg-gray-600 text-gray-200"
                }`}
              >
                {coaStatus === "verified" ? "Verified" : coaStatus === "rejected" ? "Rejected" : coaData.document ? "Pending" : "No COA"}
              </span>
              {coaData.document?.admin_note && (
                <span className="text-sm text-muted">Note: {coaData.document.admin_note}</span>
              )}
            </div>
            {coaData.document && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleViewCoa}
                  disabled={loading !== null}
                  className="btn-secondary disabled:opacity-50 text-sm"
                >
                  {loading === "coa-view" ? "Opening…" : "View COA"}
                </button>
                {coaStatus !== "verified" && (
                  <button
                    type="button"
                    onClick={handleVerifyCoa}
                    disabled={loading !== null}
                    className="btn-secondary disabled:opacity-50 text-sm"
                  >
                    {loading === "coa-verify" ? "Processing…" : "Verify"}
                  </button>
                )}
                {coaStatus !== "rejected" && coaData.document && (
                  <>
                    {!showRejectCoa ? (
                      <button
                        type="button"
                        onClick={() => setShowRejectCoa(true)}
                        disabled={loading !== null}
                        className="btn-secondary disabled:opacity-50 text-sm text-red-400"
                      >
                        Reject
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2 w-full max-w-md">
                        <textarea
                          value={coaRejectNote}
                          onChange={(e) => setCoaRejectNote(e.target.value)}
                          placeholder="Admin note (optional)"
                          rows={2}
                          className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleRejectCoa}
                            disabled={loading !== null}
                            className="btn-secondary bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm"
                          >
                            {loading === "coa-reject" ? "Processing…" : "Confirm Reject"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowRejectCoa(false); setCoaRejectNote(""); }}
                            disabled={loading !== null}
                            className="btn-secondary text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {coaRequired && coaStatus !== "verified" && (
              <p className="text-amber-400 text-sm">Product approval is disabled until COA is verified.</p>
            )}
          </>
        )}
      </div>

      <div className="surface-card p-6">
        <h3 className="font-semibold mb-4">Actions</h3>
        <div className="flex flex-wrap gap-3">
          {product.status === "pending_review" && (
            <>
              <button
                type="button"
                onClick={handleApprove}
                disabled={loading !== null || !canApprove}
                className="btn-primary disabled:opacity-50"
                title={!canApprove ? "COA must be verified before approval" : undefined}
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
