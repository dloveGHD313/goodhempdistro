import { Metadata } from "next";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getUserVerificationStatus } from "@/lib/server/idVerification";
import { getProducts } from "@/lib/server/products";
import Footer from "@/components/Footer";
import ProductsList from "./ProductsList";
import MarketSwitcher from "@/components/market/MarketSwitcher";
import { Reveal, Section, HoverLift, HeroParallax } from "@/components/motion";

export const metadata: Metadata = {
  title: "Products | Good Hemp Distro",
  description: "Browse our premium hemp products",
};

export const dynamic = 'force-dynamic';

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
  searchParams?: Promise<{ vendor?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const vendorId = resolvedSearchParams?.vendor || null;
  const supabase = await createSupabaseServerClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.warn("[products] Auth error, treating user as logged-out:", authError.message);
  }
  const user = authData?.user ?? null;

  const verification = await getUserVerificationStatus(user?.id ?? null);
  const includeGated = verification.status === "approved";
  const publicShopOnly = !user;
  const { products, vendorName, productsLookupFailed } = await getProducts(supabase, vendorId, includeGated, publicShopOnly);

  if (productsLookupFailed) {
    return (
      <div className="min-h-screen text-white flex flex-col items-center justify-center">
        <p className="text-lg text-muted">We had trouble loading products. Please try again shortly.</p>
      </div>
    );
  }

  let catalogueEmpty = false;
  if (products.length === 0) {
    let countQuery = supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .eq("active", true);
    if (vendorId) countQuery = countQuery.eq("vendor_id", vendorId);
    const { count } = await countQuery;
    catalogueEmpty = (count ?? 0) === 0;
  }

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

          <Suspense fallback={<ProductSkeleton />}>
            <ProductsList
              initialProducts={products}
              catalogueEmpty={catalogueEmpty}
            />
          </Suspense>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
