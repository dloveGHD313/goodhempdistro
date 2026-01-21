import { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import ProductsList from "./ProductsList";

export const metadata: Metadata = {
  title: "Products | Good Hemp Distro",
  description: "Browse our premium hemp products",
};

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic';

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  categories: { name: string } | null | { name: string }[];
  price_cents: number;
  featured: boolean;
};

async function getProducts(): Promise<Product[]> {
  try {
    const supabase = await createSupabaseServerClient();
    // Only fetch approved and active products for public view
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category_id, categories(name), price_cents, featured")
      .eq("status", "approved") // Only approved products
      .eq("active", true) // Only active products
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[products] Error fetching products:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[products] Fatal error fetching products:", err);
    return [];
  }
}

function ProductSkeleton() {
  return (
    <div className="card-glass p-6 animate-pulse">
      <div className="aspect-square bg-[var(--surface)]/60 rounded-lg mb-4" />
      <div className="h-6 bg-[var(--surface)]/60 rounded mb-2" />
      <div className="h-4 bg-[var(--surface)]/60 rounded mb-4" />
      <div className="flex justify-between items-center">
        <div className="h-8 bg-[var(--surface)]/60 rounded w-20" />
        <div className="h-10 bg-[var(--surface)]/60 rounded w-24" />
      </div>
    </div>
  );
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-6 text-accent">Products</h1>
          <p className="text-muted mb-12">
            Browse our curated selection of premium hemp products.
          </p>

          <ProductsList initialProducts={products} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
