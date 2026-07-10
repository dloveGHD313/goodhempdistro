import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import BuyButton from "./BuyButton";
import AddToCartStub from "./AddToCartStub";
import { getCategoryCoaRequirement, getDelta8WarningText, requiresWarning } from "@/lib/compliance";
import { isSafeNextPath } from "@/lib/phase2-workout-flow";
import FavoriteButton from "@/components/engagement/FavoriteButton";
import ReviewSection from "@/components/engagement/ReviewSection";
import Footer from "@/components/Footer";
import { isGatedProduct, requireMarketAccess } from "@/lib/server/marketGate";
import { evaluateBuyGate } from "@/lib/products/buyGate";

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  price_cents: number | null;
  is_gated: boolean;
  market_category: string | null;
  market_mode: "gated" | "ungated";
  featured: boolean;
  description?: string | null;
  vendor_id?: string | null;
  status?: string | null;
  active?: boolean | null;
  product_type?: "non_intoxicating" | "intoxicating" | "delta8";
  coa_url?: string | null;
  coa_object_path?: string | null;
  coa_verified?: boolean;
  coa_public_url?: string | null;
  category_requires_coa?: boolean;
  created_at?: string;
  image_url?: string | null;
  ship_to_states?: string[] | null;
};

type Props = {
  params: Promise<{ id: string }>;
};

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic';

type ProductFetchResult = {
  product: Product | null;
  supabaseErrorMessage: string | null;
};

async function getProduct(identifier: string): Promise<ProductFetchResult> {
  const supabase = await createSupabaseServerClient();
  const baseSelect =
    "id, name, description, category_id, price_cents, is_gated, market_category, featured, vendor_id, status, active, product_type, coa_url, coa_object_path, coa_verified, created_at, image_url, ship_to_states";
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  if (!isUuid) {
    return { product: null, supabaseErrorMessage: "not_found" };
  }

  const { data: idData, error: idError } = await supabase
    .from("products")
    .select(baseSelect)
    .eq("id", identifier)
    .maybeSingle();

  if (idError) {
    return { product: null, supabaseErrorMessage: idError.message };
  }

  let dataToUse: any = idData;

  if (!dataToUse) {
    return {
      product: null,
      supabaseErrorMessage: "not_found",
    };
  }

  
  // Products without vendor_id are not visible (consistent with list page)
  if (dataToUse.vendor_id == null || String(dataToUse.vendor_id).trim() === "") {
    return { product: null, supabaseErrorMessage: "no_vendor" };
  }

  const normalizedCoaPath = dataToUse.coa_object_path
    ? dataToUse.coa_object_path.trim().replace(/^\/+/, "")
    : "";
  const storageCoaPath = normalizedCoaPath
    ? normalizedCoaPath.startsWith("coas/")
      ? normalizedCoaPath.replace(/^coas\//, "")
      : normalizedCoaPath
    : "";
  const coaPublicUrl = storageCoaPath
    ? supabase.storage.from("coas").getPublicUrl(storageCoaPath).data.publicUrl
    : dataToUse.coa_url || null;

  // Hide product if vendor is suspended (4.3.B)
  if (dataToUse.vendor_id) {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("status")
      .eq("id", dataToUse.vendor_id)
      .maybeSingle();
    if (vendor?.status !== "active") {
      return { product: null, supabaseErrorMessage: "vendor_suspended" };
    }
  }

  // Category COA requirement (for display: View COA vs COA required badge)
  const categoryRequiresCoa = await getCategoryCoaRequirement(supabase, dataToUse.category_id);

  return {
    product: {
      ...dataToUse,
      market_mode:
        dataToUse.is_gated ||
        dataToUse.market_category === "RECREATIONAL" ||
        dataToUse.market_category === "INTOXICATING"
          ? "gated"
          : "ungated",
      coa_public_url: coaPublicUrl,
      category_requires_coa: categoryRequiresCoa,
    },
    supabaseErrorMessage: null,
  };
}

async function getCategoryName(categoryId: string | null) {
  if (!categoryId) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("categories")
      .select("name")
      .eq("id", categoryId)
      .maybeSingle();
    return data?.name || null;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[products/detail] category lookup failed", error);
    }
    return null;
  }
}

async function getVendorName(vendorId?: string | null) {
  if (!vendorId) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("vendors")
      .select("business_name")
      .eq("id", vendorId)
      .maybeSingle();
    return data?.business_name || null;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[products/detail] vendor lookup failed", error);
    }
    return null;
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const { product } = await getProduct(params.id);

  if (!product) {
    return {
      title: "Product Unavailable | Good Hemp Distro",
    };
  }

  const categoryName = await getCategoryName(product.category_id);
  
  return {
    title: `${product.name} | Good Hemp Distro`,
    description: `Shop ${product.name}${categoryName ? ` in the ${categoryName} category` : ""}`,
  };
}

export default async function ProductDetailPage(props: Props) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const stripeDetected = Boolean(process.env.STRIPE_SECRET_KEY);
  const { product, supabaseErrorMessage } = await getProduct(params.id);

  // Fetch user's location state for shipping compliance banner
  let userState: string | null = null;
  if (user) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_state")
        .eq("id", user.id)
        .maybeSingle();
      userState = (profile as { onboarding_state?: string | null } | null)?.onboarding_state ?? null;
    } catch {
      // non-critical
    }
  }

  const hasPriceCents =
    typeof product?.price_cents === "number" &&
    Number.isFinite(product.price_cents) &&
    product.price_cents > 0;
  const hasCoa =
    Boolean(product?.coa_url && product.coa_url.trim().length > 0) ||
    Boolean(product?.coa_object_path && product.coa_object_path.trim().length > 0) ||
    Boolean(product?.coa_public_url && product.coa_public_url.trim().length > 0);
  const isApprovedActive = product?.status === "approved" && product?.active === true;

  if (!product || supabaseErrorMessage) notFound();

  if (isGatedProduct(product)) {
    const gate = await requireMarketAccess(user?.id ?? null, "gated", "/verify");
    if (!gate.ok) {
      const categoryName = await getCategoryName(product.category_id);
      const vendorName = await getVendorName(product.vendor_id);
      const productName = product.name?.trim() || "Product";
      const description =
        product.description && product.description.trim().length > 0
          ? product.description.trim()
          : "Product details are coming soon.";
      return (
        <div className="min-h-screen text-white flex flex-col">
          <main className="flex-1">
            <section className="section-shell">
              <Link href="/products" className="text-accent hover:text-accent/80 transition mb-6 inline-block">
                ← Back to Products
              </Link>
              <div className="max-w-2xl mx-auto card-glass p-8 space-y-6 text-center">
                <div className="text-6xl text-muted mb-3">🔒</div>
                <h1 className="text-3xl font-bold text-accent">{productName}</h1>
                <p className="text-muted">
                  Category: {categoryName || "Uncategorized"}
                  {vendorName ? ` · Vendor: ${vendorName}` : ""}
                </p>
                <p className="text-muted text-sm leading-relaxed max-w-lg mx-auto">
                  {description.length > 200 ? `${description.slice(0, 200)}...` : description}
                </p>
                <div className="card-glass p-4 border border-yellow-500/40 text-yellow-200">
                  <p className="text-sm mb-3">
                    This product is in the gated (21+) market. Verify your age to view price, COA, and purchase.
                  </p>
                  <a href="/verify" className="btn-primary">
                    Verify 21+ to Unlock
                  </a>
                </div>
              </div>
            </section>
          </main>
          <Footer />
        </div>
      );
    }
  }

  // Phase 3B: Logged-out users cannot view/purchase COA-required products; show locked CTA with safe next
  if (!user && product.category_requires_coa) {
    const categoryNameLocked = await getCategoryName(product.category_id);
    const vendorNameLocked = await getVendorName(product.vendor_id);
    const productNameLocked = product.name?.trim() || "Product";
    const descriptionLocked =
      product.description && product.description.trim().length > 0
        ? product.description.trim().slice(0, 200) + (product.description.trim().length > 200 ? "…" : "")
        : "Product details are available after you sign in.";
    const nextPath = `/products/${params.id}`;
    const loginHref = isSafeNextPath(nextPath) ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <Link href="/products" className="text-accent hover:text-accent/80 transition mb-6 inline-block">
              ← Back to Products
            </Link>
            <div className="max-w-2xl mx-auto card-glass p-8 space-y-6 text-center">
              <div className="text-6xl text-muted mb-3">🔒</div>
              <h1 className="text-3xl font-bold text-accent">{productNameLocked}</h1>
              <p className="text-muted">
                Category: {categoryNameLocked || "Uncategorized"}
                {vendorNameLocked ? ` · Vendor: ${vendorNameLocked}` : ""}
              </p>
              <p className="text-muted text-sm leading-relaxed max-w-lg mx-auto">{descriptionLocked}</p>
              <div className="card-glass p-4 border border-amber-500/40 text-amber-200">
                <p className="text-sm mb-3">
                  This category requires a Certificate of Analysis. Sign in to view full details and purchase.
                </p>
                <Link href={loginHref} className="btn-primary inline-block">
                  Sign in to view / buy
                </Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
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
  // P0 (storefront audit 2026-07-10): COA gates purchase only when the
  // product's CATEGORY requires one (categories.requires_coa SSOT, GATE-03).
  // Gate logic lives in lib/products/buyGate.ts so it's unit-testable.
  const {
    disabled: buyButtonDisabled,
    buyButtonMessage,
    availabilityMessage,
  } = evaluateBuyGate({
    stripeEnabled,
    hasPriceCents,
    hasCoa,
    categoryRequiresCoa: product.category_requires_coa === true,
    isApprovedActive,
  });

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <nav className="mb-4 text-sm text-zinc-300" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Link href="/">Home</Link> &gt; <Link href="/products">Shop</Link> &gt; <span>{productName}</span>
          </nav>
          <Link href="/products" className="text-accent hover:text-accent/80 transition mb-6 inline-block">
            ← Back to Products
          </Link>

          {userState &&
            product.ship_to_states &&
            product.ship_to_states.length > 0 &&
            !product.ship_to_states.includes(userState) && (
              <div className="mb-6 rounded-xl border border-yellow-500/40 bg-yellow-900/20 p-4 text-yellow-200">
                <p className="font-semibold text-sm mb-1">
                  ⚠️ Shipping not available to {userState}
                </p>
                <p className="text-xs text-yellow-200/80">
                  Based on state law, this product cannot be shipped to {userState}.{" "}
                  <Link href="/compliance/state-laws" className="underline hover:text-yellow-100">
                    Why?
                  </Link>
                </p>
              </div>
            )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="card-glass p-6 aspect-square flex items-center justify-center">
              <Image
                src={product.image_url || "/placeholder-product.svg"}
                alt={productName}
                width={900}
                height={900}
                className="h-full w-full object-cover rounded-lg"
                unoptimized
              />
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

              {availabilityMessage && (
                <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 text-yellow-300 text-sm">
                  {availabilityMessage}
                </div>
              )}
              <BuyButton
                productId={product.id}
                disabled={buyButtonDisabled}
                disabledMessage={buyButtonMessage}
              />
              <AddToCartStub productId={product.id} />

              <div className="card-glass p-6 space-y-3">
                <h3 className="text-lg font-semibold">About This Product</h3>
                <p className="text-muted text-sm leading-relaxed">{description}</p>
              </div>

              {product.featured === true && (
                <div className="bg-green-900/30 border border-green-600 rounded-lg p-4">
                  <p className="text-green-400">⭐ Featured Product</p>
                </div>
              )}

              {(product.coa_public_url || (product.category_requires_coa && !hasCoa)) && (
                <div className="card-glass p-6">
                  <h3 className="text-lg font-semibold mb-2">Certificate of Analysis (COA)</h3>
                  {product.coa_public_url ? (
                    <>
                      <a
                        href={product.coa_public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent/80 underline"
                      >
                        View COA →
                      </a>
                      {product.coa_verified && (
                        <span className="ml-3 px-2 py-1 bg-green-600 text-white rounded text-xs">
                          Verified
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="inline-block px-2 py-1 bg-amber-600/80 text-white rounded text-sm">
                      COA required
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
