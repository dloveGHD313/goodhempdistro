import Link from "next/link";
import { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Products | Good Hemp Distro",
  description: "Browse our premium hemp products",
};

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
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 animate-pulse">
      <div className="aspect-square bg-gray-700 rounded-lg mb-4" />
      <div className="h-6 bg-gray-700 rounded mb-2" />
      <div className="h-4 bg-gray-700 rounded mb-4" />
      <div className="flex justify-between items-center">
        <div className="h-8 bg-gray-700 rounded w-20" />
        <div className="h-10 bg-gray-700 rounded w-24" />
      </div>
    </div>
  );
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">Products</h1>
        <p className="text-xl text-gray-300 mb-12">
          Browse our curated selection of premium hemp products.
        </p>

        {products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg mb-4">No products available at the moment.</p>
            <p className="text-gray-500">Check back soon for new arrivals!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group"
              >
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-green-600 transition h-full cursor-pointer">
                  <div className="aspect-square bg-gray-700 rounded-lg mb-4 group-hover:bg-gray-600 transition" />
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-green-400 transition">{product.name}</h3>
                  <p className="text-gray-400 mb-2 text-sm">{product.category}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-green-500">
                      ${(product.price_cents / 100).toFixed(2)}
                    </span>
                    <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition">
                      View
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-16 text-center">
          <p className="text-gray-400">
            {products.length > 0
              ? "Browse our full selection above"
              : "More products coming soon. Check back regularly for new additions."}
          </p>
        </div>
      </div>
    </main>
  );
}
