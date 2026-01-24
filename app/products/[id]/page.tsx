import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import BuyButton from "./BuyButton";
import { getDelta8WarningText, requiresWarning } from "@/lib/compliance";
import FavoriteButton from "@/components/engagement/FavoriteButton";
import ReviewSection from "@/components/engagement/ReviewSection";

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  price_cents: number;
  featured: boolean;
  product_type?: "non_intoxicating" | "intoxicating" | "delta8";
  coa_url?: string | null;
  coa_object_path?: string | null;
  coa_verified?: boolean;
  coa_public_url?: string | null;
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
      .select("id, name, category_id, price_cents, featured, product_type, coa_url, coa_object_path, coa_verified, created_at")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    const coaPublicUrl = data.coa_object_path
      ? supabase.storage.from("coas").getPublicUrl(data.coa_object_path).data.publicUrl
      : data.coa_url || null;

    return {
      ...data,
      coa_public_url: coaPublicUrl,
    };
  } catch (err) {
    console.error("Error fetching product:", err);
    return null;
  }
}

async function getCategoryName(categoryId: string | null) {
  if (!categoryId) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle();
  return data?.name || null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const product = await getProduct(params.id);

  if (!product) {
    return {
      title: "Product Not Found | Good Hemp Distro",
    };
  }

  const categoryName = await getCategoryName(product.category_id);
  
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

  const categoryName = await getCategoryName(product.category_id);

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
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-4xl font-bold mb-2">{product.name}</h1>
                <FavoriteButton entityType="product" entityId={product.id} size="md" />
              </div>
              <p className="text-gray-400 text-lg">
                Category: {categoryName || "Uncategorized"}
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

            {product.coa_public_url && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-2">Certificate of Analysis (COA)</h3>
                <a
                  href={product.coa_public_url}
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

        <div className="mt-16 space-y-6">
          <ReviewSection
            entityType="product"
            entityId={product.id}
            className="bg-gray-800 rounded-lg border border-gray-700 p-6"
            title="Product Reviews"
          />

          <div>
            <h2 className="text-2xl font-bold mb-6">More Products</h2>
            <Link
              href="/products"
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition"
            >
              Browse All Products
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
