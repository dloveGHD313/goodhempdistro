import { Metadata } from "next";
import { brand } from "@/lib/brand";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getUserVerificationStatus } from "@/lib/server/idVerification";
import { getCategoriesCoaRequirementMap } from "@/lib/compliance";
import Footer from "@/components/Footer";
import ProductsList from "./ProductsList";
import MarketSwitcher from "@/components/market/MarketSwitcher";
import { Reveal, Section, HoverLift, HeroParallax } from "@/components/motion";

export const metadata: Metadata = {
  title: "Shop Hemp Products | Good Hemp Distro",
  description:
    "Browse COA-certified hemp products from verified vendors. CBD, Delta-8, Delta-9, flower, edibles, topicals, and more — all compliant.",
  openGraph: {
    title: "Shop Hemp Products | Good Hemp Distro",
    description:
      "Browse COA-certified hemp products from verified vendors. CBD, Delta-8, Delta-9, flower, edibles, topicals, and more — all compliant.",
    url: `${brand.url}/products`,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shop Hemp Products | Good Hemp Distro",
    description:
      "Browse COA-certified hemp products from verified vendors. CBD, Delta-8, Delta-9, flower, edibles, topicals, and more — all compliant.",
  },
};

// Force dynamic rendering for filtering
export const dynamic = 'force-dynamic';

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  price_cents: number;
  is_gated: boolean;
  market_category: string | null;
  market_mode: "gated" | "ungated";
  featured: boolean;
  description?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  /** When true, category requires COA (Phase 3B: logged-out shop hides these). */
  category_requires_coa?: boolean;
  ship_to_states?: string[] | null;
};

async function getProducts(
  vendorId?: string | null,
  includeGated = false,
  /** When true, only return products whose category does NOT require COA (Phase 3B: public shop). */
  publicShopOnly = false
): Promise<{
  products: Product[];
  vendorName?: string | null;
  productsLookupFailed: boolean;
}> {
  try {
    const supabase = (() => {
      try {
        return getSupabaseAdminClient();
      } catch {
        return null;
      }
    })();
    const queryClient = supabase ?? (await createSupabaseServerClient());
    let vendorName: string | null = null;
    if (vendorId) {
      const { data: vendor } = await queryClient
        .from("vendors")
        .select("id, business_name, status")
        .eq("id", vendorId)
        .maybeSingle();

      if (!vendor || vendor.status !== "active") {
        return { products: [], vendorName: null, productsLookupFailed: false };
      }
      vendorName = vendor.business_name;
    }

    const query = queryClient
      .from("products")
      .select("id, name, category_id, price_cents, is_gated, market_category, featured, description, vendor_id, ship_to_states")
      .eq("status", "approved") // Only approved products
      .eq("active", true) // Only active products
      .order("created_at", { ascending: false });
    if (!includeGated) {
      query.eq("is_gated", false);
    }

    const { data, error } = vendorId
      ? await query.eq("vendor_id", vendorId)
      : await query;

    if (error) {
      console.error("[products] Error fetching products:", error);
      return { products: [], vendorName, productsLookupFailed: true };
    }

    const rawProducts = data || [];
    // Exclude products without vendor_id consistently (vendorless products not visible on list)
    const withVendor = rawProducts.filter((p) => p.vendor_id != null && String(p.vendor_id).trim() !== "");
    const vendorIds = Array.from(new Set(withVendor.map((p) => p.vendor_id).filter(Boolean))) as string[];

    // FIXED: prefer-const - object is mutated, not reassigned
    const vendorMap: Record<string, string> = {};
    const activeVendorIds = new Set<string>();
    let vendorStatusLookupOk = true;
    if (vendorIds.length > 0) {
      const { data: vendors, error: vendorError } = await queryClient
        .from("vendors")
        .select("id, business_name, status, is_approved")
        .in("id", vendorIds);
      if (vendorError) {
        vendorStatusLookupOk = false;
        console.warn("[products] Vendor status lookup failed; skipping active-vendor filter", {
          code: vendorError.code,
          message: vendorError.message?.slice(0, 100),
        });
      } else {
        (vendors || []).forEach((v) => {
          if (v?.id && v?.status === "active" && v?.is_approved === true) {
            activeVendorIds.add(v.id);
            vendorMap[v.id] = v.business_name || "Verified Vendor";
          }
        });
      }
    }

    // Only apply active-vendor filter when lookup succeeded; otherwise avoid silently hiding all products
    const visibleProducts = vendorStatusLookupOk
      ? withVendor.filter((p) => p.vendor_id && activeVendorIds.has(p.vendor_id))
      : withVendor;

    const categoryIds = Array.from(
      new Set(
        visibleProducts
          .map((p) => p.category_id)
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      )
    );
    const coaMap = await getCategoriesCoaRequirementMap(queryClient, categoryIds);

    let products = visibleProducts.map((product) => {
      const marketMode: "gated" | "ungated" =
        product.is_gated ||
        product.market_category === "RECREATIONAL" ||
        product.market_category === "INTOXICATING"
          ? "gated"
          : "ungated";
      const categoryRequiresCoa =
        product.category_id != null && product.category_id.trim() !== ""
          ? coaMap[product.category_id] ?? true
          : true;
      return {
        ...product,
        market_mode: marketMode,
        vendor_name: vendorName || (product.vendor_id ? vendorMap[product.vendor_id] : null) || null,
        category_requires_coa: categoryRequiresCoa,
      };
    });

    if (publicShopOnly) {
      products = products.filter((p) => p.category_requires_coa !== true);
    }

    return { products, vendorName, productsLookupFailed: false };
  } catch (err) {
    console.error("[products] Fatal error fetching products:", err);
    return { products: [], vendorName: null, productsLookupFailed: true };
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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: { vendor?: string };
}) {
  const resolvedParams = await searchParams;
  const vendorId = resolvedParams?.vendor || null;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const verification = await getUserVerificationStatus(user?.id ?? null);
  const includeGated = verification.status === "approved";
  const publicShopOnly = !user;
  const { products, vendorName, productsLookupFailed } = await getProducts(vendorId, includeGated, publicShopOnly);

  // Fetch user's onboarding state for shipping filter
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
      // non-critical — filter just won't pre-apply
    }
  }
  const countClient = (() => {
    try {
      return getSupabaseAdminClient();
    } catch {
      return supabase;
    }
  })();

  // catalogueEmpty must reflect whether any approved products exist in the DB at all —
  // not whether the access-filtered list is empty. products[] excludes gated/COA-required
  // items for certain users, so products.length===0 can be true even when inventory exists.
  // A separate unfiltered count query avoids the false "Coming Online" state for restricted users.
  let catalogueEmpty = false;
  if (products.length === 0) {
    const countQuery = countClient
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .eq("active", true);
    if (vendorId) countQuery.eq("vendor_id", vendorId);
    const { count } = await countQuery;
    catalogueEmpty = (count ?? 0) === 0;
  }

  console.info("[products/page] query result:", {
    productCount: products.length,
    catalogueEmpty,
    productsLookupFailed,
    includeGated,
    publicShopOnly,
  });

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <Section className="section-shell">
          <HeroParallax as="div" className="shop-hero card-glass p-6 mb-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <Reveal>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted mb-2">Local-first Shop</p>
                  <h1 className="text-4xl font-bold mb-3 text-accent">
                    {vendorName ? `Products from ${vendorName}` : "Local Hemp Discovery, Verified & Smooth"}
                  </h1>
                  <p className="text-muted max-w-2xl">
                    {vendorName
                      ? "Explore approved products from this vendor."
                      : "See what is deliverable near you, compare vendors, and order from verified listings."}
                  </p>
                </div>
              </Reveal>
              <div className="flex flex-col items-start gap-4">
                <div className="flex flex-wrap gap-3">
                  <HoverLift as="span">
                    <button type="button" className="btn-secondary">
                      📍 Set delivery location
                    </button>
                  </HoverLift>
                  <HoverLift as="span">
                    <button type="button" className="btn-ghost">
                      ⚡ Fastest delivery
                    </button>
                  </HoverLift>
                </div>
                <MarketSwitcher />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {[
                { label: "Avg delivery", value: "35-50 min" },
                { label: "Verified vendors", value: "120+" },
                { label: "Compliance status", value: "Always on" },
              ].map((metric) => (
                <div key={metric.label} className="shop-metric">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted">{metric.label}</span>
                  <span className="text-lg font-semibold">{metric.value}</span>
                </div>
              ))}
            </div>
          </HeroParallax>

          <ProductsList
            initialProducts={products}
            catalogueEmpty={catalogueEmpty}
            userState={userState}
          />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
