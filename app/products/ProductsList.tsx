"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCategoriesClient, type Category } from "@/lib/categories";
import SearchInput from "@/components/discovery/SearchInput";
import FilterSelect from "@/components/discovery/FilterSelect";
import FavoriteButton from "@/components/engagement/FavoriteButton";
import RatingBadge from "@/components/engagement/RatingBadge";

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  price_cents: number;
  featured: boolean;
  description?: string | null;
  vendor_name?: string | null;
};

type Props = {
  initialProducts: Product[];
  initialCategoryId?: string | null;
};

export default function ProductsList({ initialProducts, initialCategoryId }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategoryId || "");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});

  useEffect(() => {
    async function loadCategories() {
      const cats = await getCategoriesClient();
      setCategories(cats);
    }
    loadCategories();
  }, []);

  useEffect(() => {
    let filtered = initialProducts;
    if (selectedCategoryId) {
      filtered = filtered.filter((product) => product.category_id === selectedCategoryId);
    }
    if (search) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    setProducts(filtered);
  }, [selectedCategoryId, search, initialProducts]);

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

  return (
    <>
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

      {products.length === 0 ? (
        <div className="text-center py-16 card-glass p-8">
          <p className="text-muted text-lg mb-2">No products match your filters.</p>
          <p className="text-muted">Try adjusting the search or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => {
            const categoryName =
              categories.find((cat) => cat.id === product.category_id)?.name || "Uncategorized";
            const rating = ratings[product.id];
            const summary =
              product.description && product.description.trim().length > 0
                ? product.description.trim()
                : "Product details coming soon.";
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
              <Link href={`/products/${product.id}`} className="group">
                <div className="aspect-square bg-[var(--surface)]/60 rounded-lg mb-4 group-hover:bg-[var(--surface)]/80 transition" />
                <h3 className="text-xl font-semibold mb-2 group-hover:text-accent transition">{product.name}</h3>
                <p className="text-muted mb-2 text-sm">
                  {categoryName}
                </p>
                <p className="text-muted text-sm mb-3">
                  {summary.length > 120 ? `${summary.slice(0, 120)}...` : summary}
                </p>
                {product.vendor_name && (
                  <p className="text-xs text-muted">Vendor: {product.vendor_name}</p>
                )}
              </Link>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-accent">
                  ${(product.price_cents / 100).toFixed(2)}
                </span>
                <Link href={`/products/${product.id}`} className="btn-secondary px-4 py-2 rounded-lg">
                  View
                </Link>
              </div>
            </div>
          );
          })}
        </div>
      )}

      <div className="mt-16 text-center">
        <p className="text-muted">
          {products.length > 0
            ? "Browse our full selection above"
            : "More products coming soon. Check back regularly for new additions."}
        </p>
      </div>
    </>
  );
}
