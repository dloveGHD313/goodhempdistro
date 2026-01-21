import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import Footer from "@/components/Footer";
import ProductsReviewClient from "./ProductsReviewClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getPendingProducts() {
  try {
    const admin = getSupabaseAdminClient();

    const { data: products, error } = await admin
      .from("products")
      .select(`
        id,
        name,
        description,
        price_cents,
        status,
        submitted_at,
        coa_url,
        vendor_id,
        owner_user_id,
        vendors!products_vendor_id_fkey(business_name, owner_user_id),
        profiles!products_owner_user_id_fkey(email, display_name)
      `)
      .eq("status", "pending_review")
      .order("submitted_at", { ascending: true });

    if (error) {
      console.error("[admin/products] Error fetching pending products:", error);
      return { 
        products: [], 
        counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
        error: error.message 
      };
    }

    // Get all products counts for overview
    const { count: totalCount } = await admin
      .from("products")
      .select("*", { count: "exact", head: true });

    const { count: approvedCount } = await admin
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    const { count: draftCount } = await admin
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft");

    const { count: rejectedCount } = await admin
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected");

    // Normalize products (handle array relations)
    const normalizedProducts = (products || []).map((p: any) => ({
      ...p,
      vendors: Array.isArray(p.vendors) ? p.vendors[0] : p.vendors,
      profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
    }));

    return {
      products: normalizedProducts,
      counts: {
        total: totalCount || 0,
        pending: normalizedProducts.length,
        approved: approvedCount || 0,
        draft: draftCount || 0,
        rejected: rejectedCount || 0,
      },
    };
  } catch (err) {
    console.error("[admin/products] Error in getPendingProducts:", err);
    return {
      products: [],
      counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
    };
  }
}

export default async function AdminProductsPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);

  if (!user) {
    redirect("/login?redirect=/admin/products");
  }

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  const productsData = await getPendingProducts();

  console.log(`[admin/products] Admin ${user.id} viewing products. Pending: ${productsData.counts?.pending || 0}`);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Product Review Queue</h1>
          <ProductsReviewClient 
            initialProducts={productsData.products || []} 
            initialCounts={productsData.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 }} 
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
