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
  submitted_at: string;
  coa_url?: string;
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
};

export default function ProductsReviewClient({ initialProducts, initialCounts }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [counts, setCounts] = useState(initialCounts);
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);

  const handleApprove = async (productId: string) => {
    setLoading(productId);
    try {
      const response = await fetch(`/api/admin/products/${productId}/approve`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to approve product");
        setLoading(null);
        return;
      }

      // Remove from list and update counts
      setProducts(products.filter(p => p.id !== productId));
      setCounts({
        ...counts,
        pending: counts.pending - 1,
        approved: counts.approved + 1,
      });
      
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(null);
    }
  };

  const handleReject = async (productId: string) => {
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

      if (!response.ok) {
        alert(data.error || "Failed to reject product");
        setLoading(null);
        return;
      }

      // Remove from list and update counts
      setProducts(products.filter(p => p.id !== productId));
      setCounts({
        ...counts,
        pending: counts.pending - 1,
        rejected: counts.rejected + 1,
      });
      setShowRejectForm(null);
      setRejectionReason({ ...rejectionReason, [productId]: "" });
      
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

      {/* Pending Products List */}
      {products.length === 0 ? (
        <div className="card-glass p-8 text-center">
          <p className="text-muted">No products pending review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <div key={product.id} className="card-glass p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{product.name}</h3>
                    <span className="px-2 py-1 bg-yellow-600 text-yellow-100 rounded text-xs font-semibold">
                      Pending Review
                    </span>
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
                      <strong>Submitted:</strong> {new Date(product.submitted_at).toLocaleString()}
                    </div>
                    {product.coa_url && (
                      <div>
                        <strong>COA:</strong>{" "}
                        <a
                          href={product.coa_url}
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
                <div className="flex flex-col gap-2 ml-4">
                  {showRejectForm !== product.id ? (
                    <>
                      <button
                        onClick={() => handleApprove(product.id)}
                        disabled={loading === product.id}
                        className="btn-primary disabled:opacity-50 whitespace-nowrap"
                      >
                        {loading === product.id ? "Processing..." : "✓ Approve"}
                      </button>
                      <button
                        onClick={() => setShowRejectForm(product.id)}
                        disabled={loading === product.id}
                        className="btn-secondary disabled:opacity-50 whitespace-nowrap"
                      >
                        Reject
                      </button>
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
