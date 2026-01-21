"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";
import { getCategoriesClient, organizeCategoriesHierarchically, type Category } from "@/lib/categories";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function NewServicePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [hierarchicalCategories, setHierarchicalCategories] = useState<Array<Category & { children?: Category[] }>>([]);
  const [pricingType, setPricingType] = useState<"flat_fee" | "hourly" | "per_project" | "quote_only" | "">("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      const cats = await getCategoriesClient();
      // Filter to only service categories
      const serviceCats = cats.filter(cat => cat.category_type === 'service');
      setCategories(serviceCats);
      setHierarchicalCategories(organizeCategoriesHierarchically(serviceCats));
    }
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // Validate pricing
    if (pricingType && pricingType !== 'quote_only') {
      const priceCents = Math.round(parseFloat(price) * 100);
      if (!priceCents || priceCents < 0) {
        setError("Price is required for this pricing type");
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/vendors/services/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          title: name.trim() || "Untitled Service",
          description: description.trim() || null,
          category_id: categoryId || null,
          subcategory_id: subcategoryId || null,
          pricing_type: pricingType || null,
          price_cents: pricingType && pricingType !== 'quote_only' && price ? Math.round(parseFloat(price) * 100) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
          data.details ||
          data.hint ||
          data.error ||
          "Failed to create service"
        );
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/vendors/services");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold mb-8 text-accent">Create New Service</h1>

            {error && (
              <div className="card-glass p-4 mb-6 bg-red-900/30 border border-red-600 rounded-lg">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="card-glass p-4 mb-6 bg-green-900/30 border border-green-600 rounded-lg">
                <p className="text-green-400">Service created successfully! Redirecting...</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="card-glass p-8 space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Service Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  placeholder="e.g., Hemp Cultivation Consulting"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  placeholder="Describe your service..."
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium mb-2">
                  Category
                </label>
                <select
                  id="category"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategoryId(""); // Reset subcategory when parent changes
                  }}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                >
                  <option value="">Select a category (optional)</option>
                  {hierarchicalCategories.map((parent) => (
                    <optgroup key={parent.id} label={parent.name}>
                      {parent.children?.map((child) => (
                        <option key={child.id} value={child.id}>
                          {child.name}
                        </option>
                      ))}
                      {(!parent.children || parent.children.length === 0) && (
                        <option value={parent.id}>{parent.name}</option>
                      )}
                    </optgroup>
                  ))}
                </select>
                <p className="text-muted text-sm mt-1">
                  Services must use service categories
                </p>
              </div>

              <div>
                <label htmlFor="pricing_type" className="block text-sm font-medium mb-2">
                  Pricing Type
                </label>
                <select
                  id="pricing_type"
                  value={pricingType}
                  onChange={(e) => {
                    setPricingType(e.target.value as any);
                    if (e.target.value === 'quote_only') {
                      setPrice("");
                    }
                  }}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                >
                  <option value="">Select pricing type (optional)</option>
                  <option value="flat_fee">Flat Fee</option>
                  <option value="hourly">Hourly Rate</option>
                  <option value="per_project">Per Project</option>
                  <option value="quote_only">Quote Only</option>
                </select>
              </div>

              {pricingType && pricingType !== 'quote_only' && (
                <div>
                  <label htmlFor="price" className="block text-sm font-medium mb-2">
                    Price <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">$</span>
                    <input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                      className="w-full pl-8 pr-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-muted text-sm mt-1">
                    {pricingType === 'hourly' && 'Price per hour'}
                    {pricingType === 'per_project' && 'Price per project'}
                    {pricingType === 'flat_fee' && 'Fixed price'}
                  </p>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading || success}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating..." : success ? "Created!" : "Create Service"}
                </button>
                <Link href="/vendors/services" className="btn-secondary">
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
