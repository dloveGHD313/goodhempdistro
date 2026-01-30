"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { getCategoriesClient, type Category } from "@/lib/categories";
import SearchInput from "@/components/discovery/SearchInput";
import FilterSelect from "@/components/discovery/FilterSelect";
import FavoriteButton from "@/components/engagement/FavoriteButton";
import RatingBadge from "@/components/engagement/RatingBadge";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useMarketMode } from "@/lib/marketMode";

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  price_cents: number;
  is_gated: boolean;
  featured: boolean;
  description?: string | null;
  vendor_name?: string | null;
};

type Props = {
  initialProducts: Product[];
  initialCategoryId?: string | null;
};

export default function ProductsList({ initialProducts, initialCategoryId }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { mode, isVerified } = useMarketMode();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategoryId || "");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [useCase, setUseCase] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategories() {
      const cats = await getCategoriesClient();
      setCategories(cats);
    }
    loadCategories();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadProfilePreferences() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("consumer_interest_tags, consumer_use_case")
        .eq("id", user.id)
        .maybeSingle();
      if (!mounted) return;
      setInterestTags((data?.consumer_interest_tags as string[] | null) || []);
      setUseCase((data?.consumer_use_case as string | null) || null);
    }
    loadProfilePreferences();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (selectedCategoryId || categories.length === 0) return;
    const normalized = [...interestTags, useCase || ""]
      .map((value) => value.toLowerCase())
      .filter(Boolean);
    if (normalized.length === 0) return;
    const match = categories.find((category) =>
      normalized.some((tag) => category.name.toLowerCase().includes(tag))
    );
    if (match) {
      setSelectedCategoryId(match.id);
    }
  }, [categories, interestTags, useCase, selectedCategoryId]);

  useEffect(() => {
    if (!initialProducts.length) return;
    const ids = initialProducts.map((product) => product.id).join(",");
    fetch(`/api/reviews/summary?entity_type=product&entity_ids=${ids}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.summaries) {
          setRatings(data.summaries);
        }
      })
      .catch(() => undefined);

    fetch(`/api/favorites?entity_type=product&entity_ids=${ids}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const next = new Set<string>();
        (data?.favorites || []).forEach((fav: any) => next.add(fav.entity_id));
        setFavorites(next);
      })
      .catch(() => undefined);
  }, [initialProducts]);

  const effectiveMode = mode === "GATED" && isVerified ? "GATED" : "CBD";
  const showVerificationNotice = mode === "GATED" && !isVerified;

  const filteredProducts = useMemo(() => {
    let filtered = initialProducts.filter((product) =>
      effectiveMode === "CBD" ? !product.is_gated : product.is_gated
    );
    if (selectedCategoryId) {
      filtered = filtered.filter((product) => product.category_id === selectedCategoryId);
    }
    if (search) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return filtered;
  }, [effectiveMode, initialProducts, selectedCategoryId, search]);

  return (
    <>
      {showVerificationNotice && (
        <div className="card-glass p-4 mb-6 border border-yellow-500/40 text-yellow-200">
          <p className="text-sm">
            The gated market requires 21+ verification. Start verification to unlock gated
            products.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <SearchInput
          label="Search products"
          placeholder="Search by product name..."
          value={search}
          onChange={setSearch}
        />
        <FilterSelect
          label="Category"
          value={selectedCategoryId}
          options={categories.map((cat) => ({ label: cat.name, value: cat.id }))}
          placeholder="All categories"
          onChange={setSelectedCategoryId}
        />
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 card-glass p-8">
          <p className="text-muted text-lg mb-2">No products match your filters.</p>
          <p className="text-muted">Try adjusting the search or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => {
            const categoryName =
              categories.find((cat) => cat.id === product.category_id)?.name || "Uncategorized";
            const rating = ratings[product.id];
            const deliveryEta = product.featured ? "30-45 min" : "50-70 min";
            const summary =
              product.description && product.description.trim().length > 0
                ? product.description.trim()
                : "Product details coming soon.";
            const isLocked = product.is_gated && !isVerified;
            return (
              <div key={product.id} className="card-glass p-6 hover-lift h-full">
              <div className="flex items-center justify-between mb-3">
                <RatingBadge average={rating?.avg ?? null} count={rating?.count ?? 0} />
                <FavoriteButton
                  entityType="product"
                  entityId={product.id}
                  initialFavorited={favorites.has(product.id)}
                />
              </div>
              {isLocked ? (
                <div className="group">
                  <div className="aspect-square bg-[var(--surface)]/60 rounded-lg mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{product.name}</h3>
                  <p className="text-muted mb-2 text-sm">{categoryName}</p>
                  <p className="text-muted text-sm mb-3">
                    {summary.length > 120 ? `${summary.slice(0, 120)}...` : summary}
                  </p>
                  {product.vendor_name && (
                    <p className="text-xs text-muted">Vendor: {product.vendor_name}</p>
                  )}
                </div>
              ) : (
                <Link href={`/products/${product.id}`} className="group">
                  <div className="aspect-square bg-[var(--surface)]/60 rounded-lg mb-4 group-hover:bg-[var(--surface)]/80 transition" />
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-accent transition">
                    {product.name}
                  </h3>
                  <p className="text-muted mb-2 text-sm">{categoryName}</p>
                  <p className="text-muted text-sm mb-3">
                    {summary.length > 120 ? `${summary.slice(0, 120)}...` : summary}
                  </p>
                  {product.vendor_name && (
                    <p className="text-xs text-muted">Vendor: {product.vendor_name}</p>
                  )}
                </Link>
              )}
              <div className="flex flex-wrap gap-2 mt-4 mb-4">
                <span className="delivery-chip">🚚 {deliveryEta}</span>
                <span className="compliance-chip">✅ Compliance Ready</span>
                {product.is_gated ? (
                  <span className="compliance-chip">
                    {isLocked ? "🔒 Locked (21+)" : "🔒 21+ Verified"}
                  </span>
                ) : (
                  <span className="compliance-chip">CBD</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                {isLocked ? (
                  <>
                    <span className="text-sm text-muted">Price locked</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-yellow-300">
                      Verification required
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-accent">
                      ${(product.price_cents / 100).toFixed(2)}
                    </span>
                    <Link href={`/products/${product.id}`} className="btn-secondary px-4 py-2 rounded-lg">
                      View
                    </Link>
                  </>
                )}
              </div>
              </div>
          );
          })}
        </div>
      )}

      <div className="mt-16 text-center">
        <p className="text-muted">
          {filteredProducts.length > 0
            ? "Browse our full selection above"
            : "More products coming soon. Check back regularly for new additions."}
        </p>
      </div>
    </>
  );
}
