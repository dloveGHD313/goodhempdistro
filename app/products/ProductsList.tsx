"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCategoriesClient, type Category } from "@/lib/categories";

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  categories: { name: string } | null | { name: string }[];
  price_cents: number;
  featured: boolean;
};

type Props = {
  initialProducts: Product[];
  initialCategoryId?: string | null;
};

export default function ProductsList({ initialProducts, initialCategoryId }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategoryId || "");

  useEffect(() => {
    async function loadCategories() {
      const cats = await getCategoriesClient();
      setCategories(cats);
    }
    loadCategories();
  }, []);

  useEffect(() => {
    if (!selectedCategoryId) {
      setProducts(initialProducts);
    } else {
      setProducts(initialProducts.filter(p => p.category_id === selectedCategoryId));
    }
  }, [selectedCategoryId, initialProducts]);

  return (
    <>
      <div className="mb-6">
        <label htmlFor="category-filter" className="block text-sm font-medium mb-2">
          Filter by Category
        </label>
        <select
          id="category-filter"
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white max-w-xs"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16 card-glass p-8">
          <p className="text-muted text-lg mb-2">No products available in this category.</p>
          <p className="text-muted">Check back soon for new arrivals!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <Link key={product.id} href={`/products/${product.id}`} className="group">
              <div className="card-glass p-6 hover-lift h-full cursor-pointer">
                <div className="aspect-square bg-[var(--surface)]/60 rounded-lg mb-4 group-hover:bg-[var(--surface)]/80 transition" />
                <h3 className="text-xl font-semibold mb-2 group-hover:text-accent transition">{product.name}</h3>
                <p className="text-muted mb-2 text-sm">
                  {Array.isArray(product.categories) 
                    ? (product.categories[0]?.name || "Uncategorized")
                    : (product.categories?.name || "Uncategorized")}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-accent">
                    ${(product.price_cents / 100).toFixed(2)}
                  </span>
                  <button className="btn-secondary px-4 py-2 rounded-lg">
                    View
                  </button>
                </div>
              </div>
            </Link>
          ))}
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
