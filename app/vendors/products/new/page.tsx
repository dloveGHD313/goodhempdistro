"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";
import { getCategoriesClient, organizeCategoriesHierarchically, type Category } from "@/lib/categories";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getDelta8WarningText, getIntoxicatingCutoffDate, isIntoxicatingAllowedNow, requiresCOA } from "@/lib/compliance";

export default function NewProductPage() {
  const router = useRouter();
  const [draftProductId] = useState(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  });
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [hierarchicalCategories, setHierarchicalCategories] = useState<Array<Category & { children?: Category[] }>>([]);
  const [categoryRequiresCoa, setCategoryRequiresCoa] = useState(false);
  const [active, setActive] = useState(true);
  const [productType, setProductType] = useState<"non_intoxicating" | "intoxicating" | "delta8">("non_intoxicating");
  const [coaUrl, setCoaUrl] = useState("");
  const [coaObjectPath, setCoaObjectPath] = useState("");
  const [useManualUrl, setUseManualUrl] = useState(false);
  const [delta8DisclaimerAck, setDelta8DisclaimerAck] = useState(false);
  const [hempDerivedAttestation, setHempDerivedAttestation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategories() {
      const cats = await getCategoriesClient();
      setCategories(cats);
      // Organize into hierarchical structure
      setHierarchicalCategories(organizeCategoriesHierarchically(cats));
    }
    loadCategories();
  }, []);

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
        console.error("[vendors/products/new] subscription check failed", err);
        setSubscriptionActive(false);
        setIsAdmin(false);
      } finally {
        setSubscriptionChecked(true);
      }
    }

    loadSubscriptionStatus();
  }, []);

  // Phase 2: COA required by category (requiresCOA) — use loaded categories
  useEffect(() => {
    if (!categoryId || categories.length === 0) {
      setCategoryRequiresCoa(false);
      return;
    }
    const category = categories.find((c) => c.id === categoryId);
    if (!category) {
      setCategoryRequiresCoa(true); // unknown → require COA for safety
      return;
    }
    let needCoa = requiresCOA({ slug: category.slug, name: category.name });
    if (needCoa && category.parent_id) {
      const parent = categories.find((c) => c.id === category.parent_id);
      if (parent && !requiresCOA({ slug: parent.slug, name: parent.name })) {
        needCoa = false;
      }
    }
    setCategoryRequiresCoa(needCoa);
  }, [categoryId, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (subscriptionChecked && !subscriptionActive && !isAdmin) {
      setError("Active vendor plan required to upload products and COAs.");
      setLoading(false);
      return;
    }

    const priceCents = Math.round(parseFloat(price) * 100);

    if (!priceCents || priceCents < 0) {
      setError("Valid price is required");
      setLoading(false);
      return;
    }

    if (!hempDerivedAttestation) {
      setError("You must confirm this product is hemp-derived.");
      setLoading(false);
      return;
    }

    try {
      if (productType === "intoxicating" && !isIntoxicatingAllowedNow()) {
        setError(`Recreational products are only allowed until ${getIntoxicatingCutoffDate()}. The cutoff date has passed.`);
        setLoading(false);
        return;
      }

      if (productType === "delta8" && !delta8DisclaimerAck) {
        setError("Delta-8 disclaimer acknowledgement is required");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/vendors/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: draftProductId,
          name,
          description,
          price_cents: priceCents,
          category_id: categoryId || null,
          active,
          product_type: productType,
          coa_url: useManualUrl ? coaUrl.trim() : null,
          coa_object_path: !useManualUrl ? coaObjectPath.trim() || null : null,
          delta8_disclaimer_ack: productType === "delta8" ? delta8DisclaimerAck : false,
          hemp_derived_attestation: hempDerivedAttestation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle vendor account not found with better message
        if (response.status === 404 && data.hasApplication) {
          setError(
            data.applicationStatus === 'pending'
              ? "Your vendor application is pending approval. Please wait for admin approval before creating products."
              : data.applicationStatus === 'rejected'
              ? "Your vendor application was rejected. Please contact support or submit a new application."
              : "Vendor account not found. Please complete your vendor registration first."
          );
        } else {
          setError(
            data.message ||
            data.details ||
            data.hint ||
            data.error ||
            "Failed to create product"
          );
        }
        setLoading(false);
        return;
      }

      router.push("/vendors/dashboard");
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
            <h1 className="text-4xl font-bold mb-8 text-accent">Create New Product</h1>

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
                  placeholder="Product Name"
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
                  placeholder="Product description..."
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
                    placeholder="0.00"
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
                    {hierarchicalCategories.map((parent) => (
                      <optgroup key={parent.id} label={parent.name}>
                        {parent.children?.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                          </option>
                        ))}
                        {/* Also show parent as selectable if it's a category itself (has no children) */}
                        {(!parent.children || parent.children.length === 0) && (
                          <option value={parent.id}>{parent.name}</option>
                        )}
                      </optgroup>
                    ))}
                  </select>
                  {categoryRequiresCoa && (
                    <p className="text-muted text-sm mt-1">
                      {!isAdmin ? "COA required. Paste URL below or create product and upload COA on edit page." : "Optional for admin."}
                    </p>
                  )}
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
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hempDerivedAttestation}
                      onChange={(e) => setHempDerivedAttestation(e.target.checked)}
                      required
                      disabled={subscriptionChecked && !subscriptionActive && !isAdmin}
                      className="mt-1 w-4 h-4 accent-accent"
                    />
                    <span className="text-sm">
                      This product is hemp-derived <span className="text-red-400">*</span>
                    </span>
                  </label>
                </div>

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
                        {categoryRequiresCoa && !isAdmin ? "Required for this category." : "Optional. Full panel COA can be added later."}
                      </p>
                    </div>
                  ) : (
                    subscriptionChecked && !subscriptionActive && !isAdmin ? (
                      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 text-sm text-muted">
                        Uploads are disabled until an active vendor plan is applied.
                      </div>
                    ) : (
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 text-sm text-muted">
                      <p className="font-medium text-white/90">
                        COA upload — use edit page after create
                      </p>
                      <p className="mt-1">
                        {categoryRequiresCoa && !isAdmin
                          ? "For new products, paste a COA URL above, or create the product then upload COA on the edit page."
                          : "Create the product first, then upload COA on the edit page."}
                      </p>
                    </div>
                    )
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

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading || (subscriptionChecked && !subscriptionActive && !isAdmin)}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating..." : "Create Product"}
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
