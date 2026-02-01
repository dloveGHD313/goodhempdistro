"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  coa_url?: string;
  coa_object_path?: string | null;
  coa_review_url?: string | null;
  vendor_id: string;
  owner_user_id: string;
  vendors: {
    business_name: string;
    owner_user_id: string;
  } | null;
  profiles: {
    email?: string;
    display_name?: string;
  } | null;
};

type Props = {
  initialProducts: Product[];
  initialCounts: {
    total: number;
    pending: number;
    approved: number;
    draft: number;
    rejected: number;
  };
  initialStatus: string;
};

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "pending_review", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "draft", label: "Draft" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const statusMeta = (status: string) => {
  switch (status) {
    case "pending_review":
      return { label: "Pending Review", className: "bg-yellow-600 text-yellow-100" };
    case "approved":
      return { label: "Approved", className: "bg-green-600 text-green-100" };
    case "rejected":
      return { label: "Rejected", className: "bg-red-600 text-red-100" };
    case "draft":
      return { label: "Draft", className: "bg-gray-600 text-gray-200" };
    default:
      return { label: status || "Unknown", className: "bg-orange-600 text-orange-100" };
  }
};

export default function ProductsReviewClient({ initialProducts, initialCounts, initialStatus }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [counts, setCounts] = useState(initialCounts);
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState(initialStatus);
  const [listError, setListError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | "set_active" | "set_inactive" | "delete" | null>(null);
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
    if (!bulkAction) return;
    if (bulkAction === "reject" && bulkRejectReason.trim().length < 5) {
      alert("Rejection reason must be at least 5 characters");
      return;
    }
    const allowed: Record<string, string[]> = {
      approve: ["pending_review"],
      reject: ["pending_review"],
      set_active: ["approved"],
      set_inactive: ["approved"],
      delete: ["draft", "pending_review", "approved", "rejected"],
    };
    const required = allowed[bulkAction] || [];
    const selectedProducts = products.filter((p) => selected.has(p.id));
    const invalid = selectedProducts.filter((p) => !required.includes(p.status));
    if (invalid.length > 0) {
      alert(`${invalid.length} selected product(s) have invalid status for "${bulkAction}". Allowed statuses: ${required.join(", ")}.`);
      return;
    }
    setBulkLoading(true);
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
        alert(data?.error || "Bulk action failed");
        if (data?.invalid?.length) alert(`${data.invalid.length} invalid: ${data.invalid.map((i: { error: string }) => i.error).join("; ")}`);
        setBulkLoading(false);
        return;
      }
      const failed = (data.results || []).filter((r: { status: string }) => r.status === "failed");
      if (failed.length > 0) alert(`${failed.length} failed: ${failed.map((f: { error: string }) => f.error).join("; ")}`);
      setProducts(products.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
      setBulkAction(null);
      setBulkRejectReason("");
      await fetchList(activeStatus);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const adjustCounts = (fromStatus: string, toStatus: string) => {
    const map: Record<string, keyof Props["initialCounts"]> = {
      pending_review: "pending",
      approved: "approved",
      rejected: "rejected",
      draft: "draft",
    };
    const fromKey = map[fromStatus];
    const toKey = map[toStatus];
    setCounts((prev) => {
      const next = { ...prev };
      if (fromKey) {
        next[fromKey] = Math.max(0, (next[fromKey] || 0) - 1);
      }
      if (toKey) {
        next[toKey] = (next[toKey] || 0) + 1;
      }
      return next;
    });
  };

  const fetchList = async (status: string) => {
    setListError(null);
    const response = await fetch(`/api/admin/products?status=${status}&limit=50`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setListError(data?.error || "Failed to load products");
      return;
    }
    setProducts(data.data || []);
    setCounts(
      data.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 }
    );
  };

  useEffect(() => {
    const totalCount =
      (initialCounts.pending || 0) +
      (initialCounts.approved || 0) +
      (initialCounts.draft || 0) +
      (initialCounts.rejected || 0);
    if (initialProducts.length === 0 && totalCount > 0) {
      fetchList(initialStatus);
    }
  }, [initialCounts, initialProducts.length, initialStatus]);

  const handleApprove = async (productId: string) => {
    const current = products.find((product) => product.id === productId);
    if (!current) return;
    setLoading(productId);
    try {
      const response = await fetch(`/api/admin/products/${productId}/approve`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        alert(data.error || "Failed to approve product");
        setLoading(null);
        return;
      }

      // Remove from list and update counts
      setProducts(products.filter(p => p.id !== productId));
      adjustCounts(current.status, "approved");
      
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(null);
    }
  };

  const handleReject = async (productId: string) => {
    const current = products.find((product) => product.id === productId);
    if (!current) return;
    const reason = rejectionReason[productId]?.trim();
    if (!reason) {
      alert("Rejection reason is required");
      return;
    }

    setLoading(productId);
    try {
      const response = await fetch(`/api/admin/products/${productId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        alert(data.error || "Failed to reject product");
        setLoading(null);
        return;
      }

      // Remove from list and update counts
      setProducts(products.filter(p => p.id !== productId));
      adjustCounts(current.status, "rejected");
      setShowRejectForm(null);
      setRejectionReason({ ...rejectionReason, [productId]: "" });
      
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(null);
    }
  };

  const handleDelete = async (productId: string) => {
    const current = products.find((p) => p.id === productId);
    if (!current) return;
    setDeletingId(productId);
    setDeleteConfirmId(null);
    try {
      const response = await fetch(`/api/vendors/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data?.error || "Failed to delete product");
        setDeletingId(null);
        return;
      }
      setProducts(products.filter((p) => p.id !== productId));
      const map: Record<string, keyof Props["initialCounts"]> = {
        pending_review: "pending",
        approved: "approved",
        rejected: "rejected",
        draft: "draft",
      };
      const fromKey = map[current.status];
      setCounts((prev) => {
        const next = { ...prev };
        if (fromKey) next[fromKey] = Math.max(0, (next[fromKey] || 0) - 1);
        next.total = Math.max(0, (next.total || 0) - 1);
        return next;
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setDeletingId(null);
    }
  };

  const handleMarkPending = async (productId: string) => {
    const current = products.find((product) => product.id === productId);
    if (!current) return;
    setLoading(productId);
    try {
      const response = await fetch(`/api/admin/products/${productId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending_review" }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        alert(data.error || "Failed to update status");
        setLoading(null);
        return;
      }
      setProducts(products.filter((p) => p.id !== productId));
      adjustCounts(current.status, "pending_review");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(null);
    }
  };

  const vendorEmail = (product: Product) => {
    return product.profiles?.email || "N/A";
  };

  const businessName = (product: Product) => {
    return product.vendors?.business_name || "N/A";
  };

  const resolveCoaUrl = (product: Product) => {
    if (product.coa_review_url) {
      return product.coa_review_url;
    }
    if (product.coa_object_path && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const trimmedPath = product.coa_object_path.trim().replace(/^\/+/, "");
      return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/coas/${trimmedPath}`;
    }
    return product.coa_url || null;
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Total Products</div>
          <div className="text-2xl font-bold">{counts.total}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Pending Review</div>
          <div className="text-2xl font-bold text-yellow-400">{counts.pending}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Approved</div>
          <div className="text-2xl font-bold text-green-400">{counts.approved}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Drafts</div>
          <div className="text-2xl font-bold text-gray-400">{counts.draft}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Rejected</div>
          <div className="text-2xl font-bold text-red-400">{counts.rejected}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveStatus(tab.id);
              fetchList(tab.id);
              router.replace(`${pathname}?status=${tab.id}`);
            }}
            className={`btn-secondary text-sm ${
              activeStatus === tab.id ? "bg-accent text-white" : ""
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {listError && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
          {listError}
        </div>
      )}

      {selected.size > 0 && (
        <div className="card-glass p-4 flex flex-wrap items-center gap-4">
          <span className="font-medium">{selected.size} selected</span>
          {!bulkAction ? (
            <>
              {(activeStatus === "pending_review" || activeStatus === "all") && (
                <>
                  <button type="button" onClick={() => setBulkAction("approve")} className="btn-primary text-sm">
                    Approve selected
                  </button>
                  <button type="button" onClick={() => setBulkAction("reject")} className="btn-secondary text-sm">
                    Reject selected
                  </button>
                </>
              )}
              {activeStatus === "approved" && (
                <>
                  <button type="button" onClick={() => setBulkAction("set_active")} className="btn-primary text-sm">
                    Set Active
                  </button>
                  <button type="button" onClick={() => setBulkAction("set_inactive")} className="btn-secondary text-sm">
                    Set Inactive
                  </button>
                </>
              )}
              <button type="button" onClick={() => setBulkAction("delete")} className="btn-secondary text-red-400 hover:bg-red-900/30 text-sm">
                Delete selected
              </button>
              <button type="button" onClick={() => { setSelected(new Set()); setBulkAction(null); setBulkRejectReason(""); }} className="btn-secondary text-sm">
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
                {bulkLoading ? "Processing..." : `Confirm ${bulkAction.replace("_", " ")}`}
              </button>
              <button type="button" onClick={() => { setBulkAction(null); setBulkRejectReason(""); }} disabled={bulkLoading} className="btn-secondary text-sm">
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {/* Products List */}
      {products.length === 0 ? (
        <div className="card-glass p-8 text-center">
          <p className="text-muted">No products in this status.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={products.length > 0 && selected.size === products.length}
              onChange={toggleSelectAll}
              className="accent-accent"
            />
            <span className="text-sm text-muted">Select all on page</span>
          </div>
          {products.map((product) => (
            <div key={product.id} className="card-glass p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={selected.has(product.id)}
                    onChange={() => toggleSelect(product.id)}
                    className="mt-1 accent-accent"
                  />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{product.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${statusMeta(product.status).className}`}>
                      {statusMeta(product.status).label}
                    </span>
                    {product.active === true && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-green-600/30 text-green-300">Active</span>
                    )}
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="text-sm text-accent hover:underline"
                    >
                      View / Edit →
                    </Link>
                  </div>
                  {product.description && (
                    <p className="text-muted mb-2">{product.description}</p>
                  )}
                  <div className="text-sm text-muted space-y-1">
                    <div>
                      <strong>Vendor:</strong> {businessName(product)} 
                      <span className="ml-2">({vendorEmail(product)})</span>
                    </div>
                    <div>
                      <strong>Price:</strong> ${((product.price_cents || 0) / 100).toFixed(2)}
                    </div>
                    <div>
                      <strong>Submitted:</strong> {formatDate(product.submitted_at)}
                    </div>
                    {resolveCoaUrl(product) && (
                      <div>
                        <strong>COA:</strong>{" "}
                        <a
                          href={resolveCoaUrl(product) as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          View COA →
                        </a>
                      </div>
                    )}
                  </div>
                  {showRejectForm === product.id && (
                    <div className="mt-4 p-4 bg-red-900/30 border border-red-600 rounded">
                      <label className="block text-sm font-medium mb-2">
                        Rejection Reason <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        value={rejectionReason[product.id] || ""}
                        onChange={(e) =>
                          setRejectionReason({ ...rejectionReason, [product.id]: e.target.value })
                        }
                        rows={3}
                        className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                        placeholder="Explain why this product is being rejected..."
                      />
                    </div>
                  )}
                </div>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  {showRejectForm !== product.id ? (
                    <>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="btn-secondary text-center whitespace-nowrap"
                      >
                        View / Edit
                      </Link>
                      {product.status === "draft" && (
                        <button
                          onClick={() => handleMarkPending(product.id)}
                          disabled={loading === product.id}
                          className="btn-primary disabled:opacity-50 whitespace-nowrap"
                        >
                          {loading === product.id ? "Processing..." : "Mark Pending Review"}
                        </button>
                      )}
                      {product.status === "pending_review" && (
                        <button
                          onClick={() => handleApprove(product.id)}
                          disabled={loading === product.id}
                          className="btn-primary disabled:opacity-50 whitespace-nowrap"
                        >
                          {loading === product.id ? "Processing..." : "✓ Approve"}
                        </button>
                      )}
                      {(product.status === "draft" || product.status === "pending_review") && (
                        <button
                          onClick={() => setShowRejectForm(product.id)}
                          disabled={loading === product.id}
                          className="btn-secondary disabled:opacity-50 whitespace-nowrap"
                        >
                          Reject
                        </button>
                      )}
                      {deleteConfirmId === product.id ? (
                        <>
                          <p className="text-xs text-muted mb-1">Delete this product?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(product.id)}
                              disabled={deletingId === product.id}
                              className="btn-secondary bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm"
                            >
                              {deletingId === product.id ? "Deleting..." : "Yes, delete"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              disabled={deletingId === product.id}
                              className="btn-secondary text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(product.id)}
                          disabled={loading === product.id}
                          className="btn-secondary text-red-400 hover:bg-red-900/30 disabled:opacity-50 whitespace-nowrap"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleReject(product.id)}
                        disabled={loading === product.id || !rejectionReason[product.id]?.trim()}
                        className="btn-secondary bg-red-600 hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {loading === product.id ? "Processing..." : "Confirm Reject"}
                      </button>
                      <button
                        onClick={() => {
                          setShowRejectForm(null);
                          setRejectionReason({ ...rejectionReason, [product.id]: "" });
                        }}
                        disabled={loading === product.id}
                        className="btn-secondary disabled:opacity-50 whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
