"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  active: boolean;
  category_id?: string;
  submitted_at?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
};

type Props = {
  initialProducts: Product[];
  initialCounts: {
    draft: number;
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
};

export default function ProductsClient({ initialProducts, initialCounts }: Props) {
  const router = useRouter();
  const [products] = useState<Product[]>(initialProducts);
  const [counts] = useState(initialCounts);
  const [filter, setFilter] = useState<'all' | 'draft' | 'pending_review' | 'approved' | 'rejected'>('all');
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubmit = async (productId: string) => {
    setLoading(productId);
    try {
      const response = await fetch(`/api/vendors/products/${productId}/submit`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to submit product");
        setLoading(null);
        return;
      }

      // Refresh the page to show updated status
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(null);
    }
  };

  const filteredProducts = filter === 'all' 
    ? products 
    : products.filter(p => p.status === filter);

  const getStatusBadge = (status: Product['status'], active: boolean) => {
    const classes = {
      draft: "bg-gray-600 text-gray-200",
      pending_review: "bg-yellow-600 text-yellow-100",
      approved: active ? "bg-green-600 text-green-100" : "bg-green-700 text-green-200",
      rejected: "bg-red-600 text-red-100",
    };

    const labels = {
      draft: "Draft",
      pending_review: "Pending Review",
      approved: active ? "Approved & Active" : "Approved (Inactive)",
      rejected: "Rejected",
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${classes[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Total</div>
          <div className="text-2xl font-bold">{counts.total}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Drafts</div>
          <div className="text-2xl font-bold text-gray-400">{counts.draft}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Pending</div>
          <div className="text-2xl font-bold text-yellow-400">{counts.pending}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Approved</div>
          <div className="text-2xl font-bold text-green-400">{counts.approved}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Rejected</div>
          <div className="text-2xl font-bold text-red-400">{counts.rejected}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-accent text-white' : 'bg-[var(--surface)] text-white'}`}
        >
          All ({counts.total})
        </button>
        <button
          onClick={() => setFilter('draft')}
          className={`px-4 py-2 rounded ${filter === 'draft' ? 'bg-accent text-white' : 'bg-[var(--surface)] text-white'}`}
        >
          Drafts ({counts.draft})
        </button>
        <button
          onClick={() => setFilter('pending_review')}
          className={`px-4 py-2 rounded ${filter === 'pending_review' ? 'bg-accent text-white' : 'bg-[var(--surface)] text-white'}`}
        >
          Pending ({counts.pending})
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`px-4 py-2 rounded ${filter === 'approved' ? 'bg-accent text-white' : 'bg-[var(--surface)] text-white'}`}
        >
          Approved ({counts.approved})
        </button>
        <button
          onClick={() => setFilter('rejected')}
          className={`px-4 py-2 rounded ${filter === 'rejected' ? 'bg-accent text-white' : 'bg-[var(--surface)] text-white'}`}
        >
          Rejected ({counts.rejected})
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Link href="/vendors/products/new" className="btn-primary">
          + Create New Product
        </Link>
      </div>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <div className="card-glass p-8 text-center">
          <p className="text-muted mb-4">No products found.</p>
          <Link href="/vendors/products/new" className="btn-primary">
            Create Your First Product
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="card-glass p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{product.name}</h3>
                    {getStatusBadge(product.status, product.active)}
                  </div>
                  {product.description && (
                    <p className="text-muted mb-2">{product.description}</p>
                  )}
                  <div className="text-sm text-muted">
                    <span>Price: ${((product.price_cents || 0) / 100).toFixed(2)}</span>
                    {product.submitted_at && (
                      <span className="ml-4">
                        Submitted: {new Date(product.submitted_at).toLocaleDateString()}
                      </span>
                    )}
                    {product.reviewed_at && (
                      <span className="ml-4">
                        Reviewed: {new Date(product.reviewed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {product.status === 'rejected' && product.rejection_reason && (
                    <div className="mt-2 p-3 bg-red-900/30 border border-red-600 rounded">
                      <p className="text-red-400 text-sm">
                        <strong>Rejection Reason:</strong> {product.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  {product.status === 'draft' && (
                    <button
                      onClick={() => handleSubmit(product.id)}
                      disabled={loading === product.id}
                      className="btn-primary disabled:opacity-50"
                    >
                      {loading === product.id ? "Submitting..." : "Submit for Review"}
                    </button>
                  )}
                  <Link
                    href={`/vendors/products/${product.id}/edit`}
                    className="btn-secondary"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
