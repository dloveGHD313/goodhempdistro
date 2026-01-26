import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import BuyButton from "./BuyButton";
import { getDelta8WarningText, requiresWarning } from "@/lib/compliance";
import FavoriteButton from "@/components/engagement/FavoriteButton";
import ReviewSection from "@/components/engagement/ReviewSection";
import Footer from "@/components/Footer";

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  price_cents: number | null;
  featured: boolean;
  description?: string | null;
  vendor_id?: string | null;
  status?: string | null;
  active?: boolean | null;
  is_available: boolean;
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, description, category_id, price_cents, featured, vendor_id, status, active, product_type, coa_url, coa_object_path, coa_verified, created_at"
    )
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(
      `[products/detail] Failed to fetch product ${id}: ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  const coaPublicUrl = data.coa_object_path
    ? supabase.storage.from("coas").getPublicUrl(data.coa_object_path).data.publicUrl
    : data.coa_url || null;

  return {
    ...data,
    coa_public_url: coaPublicUrl,
    is_available: data.status === "approved" && data.active === true,
  };
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

async function getVendorName(vendorId?: string | null) {
  if (!vendorId) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("vendors")
    .select("business_name")
    .eq("id", vendorId)
    .maybeSingle();
  return data?.business_name || null;
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
    description: product.is_available
      ? `Shop ${product.name}${categoryName ? ` in the ${categoryName} category` : ""}`
      : "This product is not available right now.",
  };
}

export default async function ProductDetailPage(props: Props) {
  const params = await props.params;
  const stripeDetected = Boolean(process.env.STRIPE_SECRET_KEY);
  let product: Product | null = null;
  let supabaseError = false;

  try {
    product = await getProduct(params.id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    supabaseError = errorMessage.startsWith("[products/detail]");
    if (process.env.NODE_ENV !== "production") {
      console.error("[products/detail] fetch failed", error);
    }
    console.info("[products/detail] diagnostics", {
      productId: params.id,
      fetched: false,
      supabaseError,
      status: null,
      active: null,
      hasPriceCents: false,
      stripeDetected,
    });
    throw error;
  }

  const hasPriceCents =
    typeof product?.price_cents === "number" &&
    Number.isFinite(product.price_cents) &&
    product.price_cents > 0;

  console.info("[products/detail] diagnostics", {
    productId: params.id,
    fetched: Boolean(product),
    supabaseError,
    status: product?.status ?? null,
    active: product?.active ?? null,
    hasPriceCents,
    stripeDetected,
  });

  if (!product) {
    notFound();
  }

  const categoryName = await getCategoryName(product.category_id);
  const vendorName = await getVendorName(product.vendor_id);
  const productName = product.name?.trim() || "Product";
  const description =
    product.description && product.description.trim().length > 0
      ? product.description.trim()
      : "Product details are coming soon.";
  const priceLabel =
    typeof product.price_cents === "number" &&
    Number.isFinite(product.price_cents) &&
    product.price_cents > 0
      ? `$${(product.price_cents / 100).toFixed(2)}`
      : "Price unavailable";
  const stripeEnabled = stripeDetected;
  const buyButtonDisabled = !stripeEnabled || !hasPriceCents;
  const buyButtonMessage = !hasPriceCents && !stripeEnabled
    ? "Checkout is not configured and price is unavailable."
    : !hasPriceCents
      ? "Price unavailable."
      : !stripeEnabled
        ? "Checkout is not configured."
        : null;

  if (!product.is_available) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="max-w-3xl mx-auto card-glass p-8 space-y-6 text-center">
              <div className="space-y-4">
                <h1 className="text-3xl font-bold text-accent">This product is not available</h1>
                <p className="text-muted">
                  This listing is not currently available. Please browse other products.
                </p>
              </div>
              <BuyButton
                productId={product.id}
                disabled
                disabledMessage="Product unavailable."
              />
              <Link href="/products" className="btn-primary">
                Back to Products
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <Link href="/products" className="text-accent hover:text-accent/80 transition mb-6 inline-block">
            ← Back to Products
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="card-glass p-6 aspect-square flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl text-muted mb-3">📦</div>
                <p className="text-muted text-sm">Product image coming soon.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-4xl font-bold mb-2">{productName}</h1>
                  <FavoriteButton entityType="product" entityId={product.id} size="md" />
                </div>
                <p className="text-muted text-lg">
                  Category: {categoryName || "Uncategorized"}
                </p>
                {vendorName && (
                  <p className="text-muted text-sm mt-1">Vendor: {vendorName}</p>
                )}
                <p className="text-muted text-sm mt-1">Availability: In stock</p>
              </div>

              <div className="card-glass p-6">
                <p className="text-muted text-sm mb-2">Price</p>
                <p className="text-4xl font-bold text-accent">{priceLabel}</p>
              </div>

              <BuyButton
                productId={product.id}
                disabled={buyButtonDisabled}
                disabledMessage={buyButtonMessage}
              />

              <div className="card-glass p-6 space-y-3">
                <h3 className="text-lg font-semibold">About This Product</h3>
                <p className="text-muted text-sm leading-relaxed">{description}</p>
              </div>

              {product.featured === true && (
                <div className="bg-green-900/30 border border-green-600 rounded-lg p-4">
                  <p className="text-green-400">⭐ Featured Product</p>
                </div>
              )}

              {product.coa_public_url && (
                <div className="card-glass p-6">
                  <h3 className="text-lg font-semibold mb-2">Certificate of Analysis (COA)</h3>
                  <a
                    href={product.coa_public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent/80 underline"
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
              className="card-glass p-6"
              title="Product Reviews"
            />

            <div>
              <h2 className="text-2xl font-bold mb-4">More Products</h2>
              <Link href="/products" className="btn-secondary">
                Browse All Products
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
