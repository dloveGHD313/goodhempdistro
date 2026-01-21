import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { hasVendorContext } from "@/lib/authz";
import Footer from "@/components/Footer";
import ProductsClient from "./ProductsClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getVendorProducts(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Get vendor
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, owner_user_id")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (!vendor) {
      return null;
    }

    // Get all products for this vendor (all statuses)
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, description, price_cents, status, active, category_id, submitted_at, reviewed_at, rejection_reason, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[vendors/products] Error fetching products:", error);
      return { products: [], error: error.message };
    }

    // Group by status
    const drafts = (products || []).filter(p => p.status === 'draft');
    const pending = (products || []).filter(p => p.status === 'pending_review');
    const approved = (products || []).filter(p => p.status === 'approved');
    const rejected = (products || []).filter(p => p.status === 'rejected');

    return {
      products: products || [],
      counts: {
        draft: drafts.length,
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        total: (products || []).length,
      },
    };
  } catch (err) {
    console.error("[vendors/products] Error in getVendorProducts:", err);
    return { 
      products: [], 
      counts: { draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 } 
    };
  }
}

export default async function VendorProductsPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/products");
  }

  // Check vendor context
  const { hasContext } = await hasVendorContext(supabase, user.id);

  if (!hasContext) {
    redirect("/vendor-registration");
  }

  const productsData = await getVendorProducts(user.id);

  if (!productsData) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="card-glass p-8 text-center">
              <h1 className="text-2xl font-bold mb-4 text-red-400">Vendor Account Not Found</h1>
              <p className="text-muted mb-6">
                Your vendor account could not be found. Please contact support.
              </p>
              <a href="/vendors/dashboard" className="btn-secondary">
                Back to Dashboard
              </a>
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
          <h1 className="text-4xl font-bold mb-8 text-accent">My Products</h1>
          <ProductsClient 
            initialProducts={productsData.products || []} 
            initialCounts={productsData.counts || { draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 }} 
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
