"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";
import type { Category } from "@/lib/categories";
import { getDelta8WarningText, getIntoxicatingCutoffDate, isIntoxicatingAllowedNow, requiresCOA } from "@/lib/compliance";
import COAUpload from "./COAUpload";
import { createSupabaseBrowserClient } from "@/lib/supabase";

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
  rejection_reason?: string | null;
};

type Props = {
  productId: string;
  initialProduct: Product;
  initialCategories: Category[];
};

export default function EditProductForm({ productId, initialProduct, initialCategories }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialProduct.name);
  const [description, setDescription] = useState(initialProduct.description || "");
  const [price, setPrice] = useState(((initialProduct.price_cents || 0) / 100).toFixed(2));
  const [categoryId, setCategoryId] = useState<string>(initialProduct.category_id || "");
  const [active, setActive] = useState(initialProduct.active);
  const [productType, setProductType] = useState<"non_intoxicating" | "intoxicating" | "delta8">(
    (initialProduct.product_type as "non_intoxicating" | "intoxicating" | "delta8") || "non_intoxicating"
  );
  const [coaUrl, setCoaUrl] = useState(initialProduct.coa_url || "");
  const [coaObjectPath, setCoaObjectPath] = useState(initialProduct.coa_object_path || "");
  const [useManualUrl, setUseManualUrl] = useState(!!initialProduct.coa_url);
  const [delta8DisclaimerAck, setDelta8DisclaimerAck] = useState(initialProduct.delta8_disclaimer_ack || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);

  const normalizedCoaPath = coaObjectPath
    ? coaObjectPath.trim().replace(/^\/+/, "")
    : "";
  const storageCoaPath = normalizedCoaPath
    ? normalizedCoaPath.startsWith("coas/")
      ? normalizedCoaPath.replace(/^coas\//, "")
      : normalizedCoaPath
    : null;
  const coaObjectUrl =
    storageCoaPath && process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/coas/${storageCoaPath}`
      : null;

  // Phase 2: COA required by category (requiresCOA) — use initialCategories
  const categoryRequiresCoa = useMemo(() => {
    if (!categoryId || !initialCategories.length) return false;
    const category = initialCategories.find((c) => c.id === categoryId);
    if (!category) return true;
    let needCoa = requiresCOA({ slug: category.slug, name: category.name });
    if (needCoa && category.parent_id) {
      const parent = initialCategories.find((c) => c.id === category.parent_id);
      if (parent && !requiresCOA({ slug: parent.slug, name: parent.name })) needCoa = false;
    }
    return needCoa;
  }, [categoryId, initialCategories]);

  useEffect(() => {
    async function loadSubscriptionStatus() {
      try {
        const response = await fetch("/api/vendor/status", { cache: "no-store" });
        if (!response.ok) {
          setSubscriptionActive(false);
          setIsAdmin(false);
          return;
        }
        const payload = await response.json();
        const subscribed = Boolean(payload?.isSubscribed);
        const admin = Boolean(payload?.isAdmin);
        setSubscriptionActive(subscribed || admin);
        setIsAdmin(admin);
      } catch (err) {
        console.error("[vendors/products/edit] subscription check failed", err);
        setSubscriptionActive(false);
        setIsAdmin(false);
      } finally {
        setSubscriptionChecked(true);
      }
    }

    loadSubscriptionStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (subscriptionChecked && !subscriptionActive && !isAdmin) {
      setError("Active vendor plan required to upload products and COAs.");
      setSaving(false);
      return;
    }

    const priceCents = Math.round(parseFloat(price) * 100);

    if (!priceCents || priceCents < 0) {
      setError("Valid price is required");
      setSaving(false);
      return;
    }

    if (productType === "intoxicating" && !isIntoxicatingAllowedNow()) {
      setError(`Recreational products are only allowed until ${getIntoxicatingCutoffDate()}. The cutoff date has passed.`);
      setSaving(false);
      return;
    }

    if (productType === "delta8" && !delta8DisclaimerAck) {
      setError("Delta-8 disclaimer acknowledgement is required");
      setSaving(false);
      return;
    }

    // Backend enforces COA when category requires it (admin bypass).

    try {
      const response = await fetch(`/api/vendors/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Failed to delete product");
        setDeleting(false);
        return;
      }
      router.push("/vendors/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  };

  const status = initialProduct?.status ?? "draft";

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold mb-8 text-accent">Edit Product</h1>

            {status === "approved" && (
              <div className="surface-card p-4 mb-6 bg-yellow-900/30 border border-yellow-600 rounded-lg">
                <p className="text-yellow-400">
                  This product is approved. Changes may require re-approval.
                </p>
              </div>
            )}

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
                    {initialCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-6 space-y-6">
                {subscriptionChecked && !subscriptionActive && !isAdmin && (
                  <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 text-yellow-300 text-sm">
                    Active vendor plan required to upload products and COAs.{" "}
                    <Link href="/pricing" className="underline text-accent">
                      View plans
                    </Link>
                  </div>
                )}
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
                    disabled={subscriptionChecked && !subscriptionActive && !isAdmin}
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  >
                    <option value="non_intoxicating">Non-Recreational</option>
                    <option value="intoxicating" disabled={!isIntoxicatingAllowedNow()}>
                      Recreational {!isIntoxicatingAllowedNow() ? `(Not allowed after ${getIntoxicatingCutoffDate()})` : ""}
                    </option>
                    <option value="delta8">Delta-8</option>
                  </select>
                  {productType === "intoxicating" && !isIntoxicatingAllowedNow() && (
                    <p className="text-red-400 text-sm mt-2">
                      Recreational products are only allowed until {getIntoxicatingCutoffDate()}
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
                      disabled={subscriptionChecked && !subscriptionActive && !isAdmin}
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
                        disabled={subscriptionChecked && !subscriptionActive && !isAdmin}
                        className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                        placeholder="https://example.com/coa.pdf"
                      />
                      <p className="text-sm text-muted mt-1">
                        {categoryRequiresCoa && !isAdmin ? "Full panel COA required before approval." : "Optional for admin."}
                      </p>
                    </div>
                  ) : subscriptionChecked && !subscriptionActive && !isAdmin ? (
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 text-sm text-muted">
                      Uploads are disabled until an active vendor plan is applied.
                    </div>
                  ) : (
                    <COAUpload
                      productId={productId}
                      label={categoryRequiresCoa && !isAdmin ? "Upload COA (required)" : "Upload COA (optional)"}
                      required={categoryRequiresCoa && !isAdmin}
                      existingStoragePath={storageCoaPath}
                      onUploaded={(path) => setCoaObjectPath(path)}
                      helperText="Upload a PDF or image of your full panel COA (max 50MB). Uses product_documents."
                      disabled={subscriptionChecked && !subscriptionActive && !isAdmin}
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
                        disabled={subscriptionChecked && !subscriptionActive && !isAdmin}
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
                      disabled={subscriptionChecked && !subscriptionActive && !isAdmin}
                      className="w-4 h-4 text-accent"
                    />
                    <span>Active (visible to customers)</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 items-center">
                <button
                  type="submit"
                  disabled={saving || deleting || (subscriptionChecked && !subscriptionActive && !isAdmin)}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Save Product"}
                </button>
                <Link href="/vendors/dashboard" className="btn-secondary">
                  Cancel
                </Link>
                <span className="flex-1" />
                {!deleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    disabled={saving || deleting}
                    className="text-red-400 hover:text-red-300 border border-red-600 rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                  >
                    Delete product
                  </button>
                ) : (
                  <span className="flex gap-2 items-center text-sm">
                    <span className="text-muted">Delete this product?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-red-600 text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      disabled={deleting}
                      className="btn-secondary text-sm py-1.5"
                    >
                      Cancel
                    </button>
                  </span>
                )}
              </div>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
