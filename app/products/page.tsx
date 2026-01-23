import { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import ProductsList from "./ProductsList";

export const metadata: Metadata = {
  title: "Products | Good Hemp Distro",
  description: "Browse our premium hemp products",
};

// Force dynamic rendering for filtering
export const dynamic = 'force-dynamic';

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  price_cents: number;
  featured: boolean;
};

async function getProducts(vendorId?: string | null): Promise<{
  products: Product[];
  vendorName?: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    let vendorName: string | null = null;
    if (vendorId) {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, business_name")
        .eq("id", vendorId)
        .eq("is_active", true)
        .eq("is_approved", true)
        .maybeSingle();

      if (!vendor) {
        return { products: [], vendorName: null };
      }
      vendorName = vendor.business_name;
    }

    const query = supabase
      .from("products")
      .select("id, name, category_id, price_cents, featured")
      .eq("status", "approved") // Only approved products
      .eq("active", true) // Only active products
      .order("created_at", { ascending: false });

    const { data, error } = vendorId
      ? await query.eq("vendor_id", vendorId)
      : await query;

    if (error) {
      console.error("[products] Error fetching products:", error);
      return { products: [], vendorName };
    }

    return { products: data || [], vendorName };
  } catch (err) {
    console.error("[products] Fatal error fetching products:", err);
    return { products: [], vendorName: null };
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
  const vendorId = searchParams?.vendor || null;
  const { products, vendorName } = await getProducts(vendorId);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-6 text-accent">
            {vendorName ? `Products from ${vendorName}` : "Products"}
          </h1>
          <p className="text-muted mb-12">
            {vendorName
              ? "Explore approved products from this vendor."
              : "Browse our curated selection of premium hemp products."}
          </p>

          <ProductsList initialProducts={products} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
