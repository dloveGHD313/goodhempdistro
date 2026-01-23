"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCategoriesClient, type Category } from "@/lib/categories";
import SearchInput from "@/components/discovery/SearchInput";
import FilterSelect from "@/components/discovery/FilterSelect";

type Product = {
  id: string;
  name: string;
  category_id: string | null;
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
  const [search, setSearch] = useState("");

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
            return (
            <Link key={product.id} href={`/products/${product.id}`} className="group">
              <div className="card-glass p-6 hover-lift h-full cursor-pointer">
                <div className="aspect-square bg-[var(--surface)]/60 rounded-lg mb-4 group-hover:bg-[var(--surface)]/80 transition" />
                <h3 className="text-xl font-semibold mb-2 group-hover:text-accent transition">{product.name}</h3>
                <p className="text-muted mb-2 text-sm">
                  {categoryName}
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
