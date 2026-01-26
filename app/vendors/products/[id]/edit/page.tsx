"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import { getCategoriesClient, type Category } from "@/lib/categories";
import { getDelta8WarningText, getIntoxicatingCutoffDate, isIntoxicatingAllowedNow } from "@/lib/compliance";
import UploadField from "@/components/UploadField";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category_id: string | null;
  active: boolean;
};

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [active, setActive] = useState(true);
  const [productType, setProductType] = useState<"non_intoxicating" | "intoxicating" | "delta8">("non_intoxicating");
  const [coaUrl, setCoaUrl] = useState("");
  const [coaObjectPath, setCoaObjectPath] = useState("");
  const [useManualUrl, setUseManualUrl] = useState(false);
  const [delta8DisclaimerAck, setDelta8DisclaimerAck] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedCoaPath = coaObjectPath
    ? coaObjectPath.trim().replace(/^\/+/, "")
    : "";
  const storageCoaPath = normalizedCoaPath
    ? normalizedCoaPath.startsWith("coas/")
      ? normalizedCoaPath
      : `coas/${normalizedCoaPath}`
    : null;
  const coaObjectUrl =
    storageCoaPath && process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/coas/${storageCoaPath}`
      : null;

  useEffect(() => {
    async function loadData() {
      try {
        // Load categories
        const cats = await getCategoriesClient();
        setCategories(cats);

        // Load product
        const supabase = createSupabaseBrowserClient();
        const { data, error: fetchError } = await supabase
          .from("products")
          .select("id, name, description, price_cents, category_id, active, product_type, coa_url, coa_object_path, delta8_disclaimer_ack")
          .eq("id", productId)
          .single();

        if (fetchError || !data) {
          setError("Product not found");
          setLoading(false);
          return;
        }

        setProduct(data);
        setName(data.name);
        setDescription(data.description || "");
        setPrice(((data.price_cents || 0) / 100).toFixed(2));
        setCategoryId(data.category_id || "");
        setActive(data.active);
        setProductType((data.product_type as "non_intoxicating" | "intoxicating" | "delta8") || "non_intoxicating");
        setCoaUrl(data.coa_url || "");
        setCoaObjectPath(data.coa_object_path || "");
        setUseManualUrl(!!data.coa_url);
        setDelta8DisclaimerAck(data.delta8_disclaimer_ack || false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load product");
      } finally {
        setLoading(false);
      }
    }

    if (productId) {
      loadData();
    }
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const priceCents = Math.round(parseFloat(price) * 100);

    if (!priceCents || priceCents < 0) {
      setError("Valid price is required");
      setSaving(false);
      return;
    }

    // COA is optional while editing drafts; enforcement happens on review if required

    if (productType === "intoxicating" && !isIntoxicatingAllowedNow()) {
      setError(`Intoxicating products are only allowed until ${getIntoxicatingCutoffDate()}. The cutoff date has passed.`);
      setSaving(false);
      return;
    }

    if (productType === "delta8" && !delta8DisclaimerAck) {
      setError("Delta-8 disclaimer acknowledgement is required");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/vendors/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          price_cents: priceCents,
          category_id: categoryId || null,
          active,
          product_type: productType,
          coa_url: useManualUrl ? coaUrl.trim() : null,
          coa_object_path: !useManualUrl ? coaObjectPath.trim() || null : null,
          delta8_disclaimer_ack: productType === "delta8" ? delta8DisclaimerAck : false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update product");
        setSaving(false);
        return;
      }

      router.push("/vendors/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="max-w-2xl mx-auto surface-card p-8 text-center">
              <p className="text-muted mb-4">Product not found</p>
              <Link href="/vendors/dashboard" className="btn-primary">
                Back to Dashboard
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold mb-8 text-accent">Edit Product</h1>

            <form onSubmit={handleSubmit} className="space-y-6 surface-card p-8">
              {error && (
                <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Product Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
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
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium mb-2">
                    Price ($) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    id="price"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium mb-2">
                    Category
                  </label>
                  <select
                    id="category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  >
                    <option value="">Select a category (optional)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-6 space-y-6">
                <div>
                  <label htmlFor="product_type" className="block text-sm font-medium mb-2">
                    Product Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="product_type"
                    value={productType}
                    onChange={(e) => {
                      setProductType(e.target.value as "non_intoxicating" | "intoxicating" | "delta8");
                      if (e.target.value !== "delta8") {
                        setDelta8DisclaimerAck(false);
                      }
                    }}
                    required
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  >
                    <option value="non_intoxicating">Non-Intoxicating</option>
                    <option value="intoxicating" disabled={!isIntoxicatingAllowedNow()}>
                      Intoxicating {!isIntoxicatingAllowedNow() ? `(Not allowed after ${getIntoxicatingCutoffDate()})` : ""}
                    </option>
                    <option value="delta8">Delta-8</option>
                  </select>
                  {productType === "intoxicating" && !isIntoxicatingAllowedNow() && (
                    <p className="text-red-400 text-sm mt-2">
                      Intoxicating products are only allowed until {getIntoxicatingCutoffDate()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={useManualUrl}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseManualUrl(checked);
                        if (checked) {
                          setCoaObjectPath("");
                        } else {
                          setCoaUrl("");
                        }
                      }}
                      className="w-4 h-4 accent-accent"
                    />
                    <span className="text-sm text-muted">Paste URL instead</span>
                  </label>
                  {useManualUrl ? (
                    <div>
                      <input
                        type="url"
                        id="coa_url"
                        value={coaUrl}
                        onChange={(e) => setCoaUrl(e.target.value)}
                        className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                        placeholder="https://example.com/coa.pdf"
                      />
                      <p className="text-sm text-muted mt-1">Full panel COA required before approval</p>
                    </div>
                  ) : (
                    <UploadField
                      bucket="coas"
                      folderPrefix={`coas/${productId}`}
                      label="COA Document (Full Panel Required)"
                      required
                      existingUrl={coaObjectUrl}
                      onUploaded={(path) => setCoaObjectPath(path)}
                      helperText="Upload a PDF or image of your full panel COA (max 50MB)"
                    />
                  )}
                </div>

                {productType === "delta8" && (
                  <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
                    <p className="text-yellow-400 text-sm mb-3">{getDelta8WarningText()}</p>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={delta8DisclaimerAck}
                        onChange={(e) => setDelta8DisclaimerAck(e.target.checked)}
                        required={productType === "delta8"}
                        className="mt-1 w-4 h-4 accent-accent"
                      />
                      <span className="text-sm">
                        I acknowledge the Delta-8 disclaimer <span className="text-red-400">*</span>
                      </span>
                    </label>
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="w-4 h-4 text-accent"
                    />
                    <span>Active (visible to customers)</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save Product"}
                </button>
                <Link href="/vendors/dashboard" className="btn-secondary">
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
