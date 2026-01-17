import Link from "next/link";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Products | Good Hemp Distro",
  description: "Browse our premium hemp products",
};

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic';

type Product = {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  featured: boolean;
};

async function getProducts(): Promise<Product[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      redirect("/login");
    }
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, price_cents, featured")
      .eq("featured", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching products:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Fatal error fetching products:", err);
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

          {products.length === 0 ? (
            <div className="text-center py-16 card-glass p-8">
              <p className="text-muted text-lg mb-2">No products available at the moment.</p>
              <p className="text-muted">Check back soon for new arrivals!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map((product) => (
                <Link key={product.id} href={`/products/${product.id}`} className="group">
                  <div className="card-glass p-6 hover-lift h-full cursor-pointer">
                    <div className="aspect-square bg-[var(--surface)]/60 rounded-lg mb-4 group-hover:bg-[var(--surface)]/80 transition" />
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-accent transition">{product.name}</h3>
                    <p className="text-muted mb-2 text-sm">{product.category}</p>
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
        </section>
      </main>
      <Footer />
    </div>
  );
}
