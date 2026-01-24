"use client";

import { useState } from "react";

type Vendor = {
  id: string;
  business_name: string;
  coa_attested: boolean;
  coa_attested_at: string | null;
  intoxicating_policy_ack: boolean;
  intoxicating_policy_ack_at: string | null;
  status: string;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  product_type: string;
  coa_url: string | null;
  coa_object_path?: string | null;
  coa_review_url?: string | null;
  coa_verified: boolean;
  delta8_disclaimer_ack: boolean;
  vendor_id: string;
  vendors: { business_name: string } | { business_name: string }[] | null;
};

type Props = {
  initialVendors: Vendor[];
  initialProducts: Product[];
};

export default function ComplianceClient({ initialVendors, initialProducts }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [products, setProducts] = useState<Product[]>(initialProducts);

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

  const toggleCoaVerified = async (productId: string, currentValue: boolean) => {
    try {
      const response = await fetch(`/api/admin/products/${productId}/coa-verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coa_verified: !currentValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to update COA verification");
        return;
      }

      setProducts(products.map(p => p.id === productId ? { ...p, coa_verified: !currentValue } : p));
    } catch (error) {
      alert("Failed to update COA verification");
    }
  };

  return (
    <div className="space-y-8">
      <div className="card-glass p-6">
        <h2 className="text-2xl font-bold mb-4">Vendor Compliance</h2>
        {vendors.length === 0 ? (
          <p className="text-muted">No vendors found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="pb-3 font-semibold text-muted">Business Name</th>
                  <th className="pb-3 font-semibold text-muted">COA Attested</th>
                  <th className="pb-3 font-semibold text-muted">Intoxicating Ack</th>
                  <th className="pb-3 font-semibold text-muted">Status</th>
                  <th className="pb-3 font-semibold text-muted">Created</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-[var(--border)]/60">
                    <td className="py-3 font-semibold">{vendor.business_name}</td>
                    <td className="py-3">
                      <span className={vendor.coa_attested ? "text-green-400" : "text-red-400"}>
                        {vendor.coa_attested ? "✓" : "✗"}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={vendor.intoxicating_policy_ack ? "text-green-400" : "text-red-400"}>
                        {vendor.intoxicating_policy_ack ? "✓" : "✗"}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${vendor.status === "active" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                        {vendor.status}
                      </span>
                    </td>
                    <td className="py-3 text-muted">
                      {new Date(vendor.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card-glass p-6">
        <h2 className="text-2xl font-bold mb-4">Product Compliance</h2>
        {products.length === 0 ? (
          <p className="text-muted">No products found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="pb-3 font-semibold text-muted">Product</th>
                  <th className="pb-3 font-semibold text-muted">Vendor</th>
                  <th className="pb-3 font-semibold text-muted">Type</th>
                  <th className="pb-3 font-semibold text-muted">COA URL</th>
                  <th className="pb-3 font-semibold text-muted">COA Verified</th>
                  <th className="pb-3 font-semibold text-muted">Delta-8 Ack</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-[var(--border)]/60">
                    <td className="py-3 font-semibold">{product.name}</td>
                    <td className="py-3 text-muted">
                      {Array.isArray(product.vendors) 
                        ? (product.vendors[0]?.business_name || "N/A")
                        : (product.vendors?.business_name || "N/A")}
                    </td>
                    <td className="py-3 text-muted capitalize">{product.product_type}</td>
                    <td className="py-3">
                      {resolveCoaUrl(product) ? (
                        <a href={resolveCoaUrl(product) as string} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-sm">
                          View COA
                        </a>
                      ) : (
                        <span className="text-red-400">Missing</span>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleCoaVerified(product.id, product.coa_verified)}
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          product.coa_verified
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {product.coa_verified ? "Verified" : "Verify"}
                      </button>
                    </td>
                    <td className="py-3">
                      <span className={product.delta8_disclaimer_ack ? "text-green-400" : "text-gray-400"}>
                        {product.delta8_disclaimer_ack ? "✓" : "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
