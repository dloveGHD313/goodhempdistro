import Link from "next/link";
import { Metadata, MetadataRoute } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import BuyButton from "./BuyButton";
import { getDelta8WarningText, requiresWarning } from "@/lib/compliance";

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  categories: { name: string } | null | { name: string }[];
  price_cents: number;
  featured: boolean;
  product_type?: "non_intoxicating" | "intoxicating" | "delta8";
  coa_url?: string | null;
  coa_verified?: boolean;
  created_at?: string;
};

type Props = {
  params: Promise<{ id: string }>;
};

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic';

async function getProduct(id: string): Promise<Product | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category_id, categories(name), price_cents, featured, product_type, coa_url, coa_verified, created_at")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error fetching product:", err);
    return null;
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const product = await getProduct(params.id);

  if (!product) {
    return {
      title: "Product Not Found | Good Hemp Distro",
    };
  }

  const categoryName = Array.isArray(product.categories) 
    ? (product.categories[0]?.name || null)
    : (product.categories?.name || null);
  
  return {
    title: `${product.name} | Good Hemp Distro`,
    description: `Shop ${product.name}${categoryName ? ` in the ${categoryName} category` : ''}`,
  };
}

export default async function ProductDetailPage(props: Props) {
  const params = await props.params;
  const product = await getProduct(params.id);

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <Link href="/products" className="text-green-400 hover:text-green-300 transition mb-8 inline-block">
          ← Back to Products
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
          {/* Product Image */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 aspect-square flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl text-gray-700 mb-4">📦</div>
              <p className="text-gray-400">Product Image</p>
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">{product.name}</h1>
              <p className="text-gray-400 text-lg">
                Category: {Array.isArray(product.categories) 
                  ? (product.categories[0]?.name || "Uncategorized")
                  : (product.categories?.name || "Uncategorized")}
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <p className="text-gray-400 text-sm mb-2">Price</p>
              <p className="text-5xl font-bold text-green-500">
                ${(product.price_cents / 100).toFixed(2)}
              </p>
            </div>

            <BuyButton productId={product.id} />

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-3">
              <h3 className="text-lg font-semibold">About This Product</h3>
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Premium quality assurance</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Third-party lab tested</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Fast and discreet shipping</span>
                </li>
              </ul>
            </div>

            {product.featured && (
              <div className="bg-green-900/30 border border-green-600 rounded-lg p-4">
                <p className="text-green-400">⭐ Featured Product</p>
              </div>
            )}

            {product.coa_url && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-2">Certificate of Analysis (COA)</h3>
                <a
                  href={product.coa_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 underline"
                >
                  View Full Panel COA →
                </a>
                {product.coa_verified && (
                  <span className="ml-3 px-2 py-1 bg-green-600 text-white rounded text-xs">
                    Verified
                  </span>
                )}
              </div>
            )}

            {product.product_type === "delta8" && requiresWarning(product.product_type) && (
              <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
                <p className="text-yellow-400 text-sm">{getDelta8WarningText()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Related Products Section */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-8">More Products</h2>
          <Link
            href="/products"
            className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition"
          >
            Browse All Products
          </Link>
        </div>
      </div>
    </main>
  );
}
