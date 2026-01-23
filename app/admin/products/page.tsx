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
      .select(
        "id, name, description, price_cents, status, submitted_at, coa_url, vendor_id, owner_user_id"
      )
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

    const vendorIds = Array.from(
      new Set((products || []).map((p: any) => p.vendor_id).filter(Boolean))
    );
    const ownerIds = Array.from(
      new Set((products || []).map((p: any) => p.owner_user_id).filter(Boolean))
    );

    const { data: vendors } = vendorIds.length
      ? await admin
          .from("vendors")
          .select("id, business_name, owner_user_id")
          .in("id", vendorIds)
      : { data: [] };

    const { data: profiles } = ownerIds.length
      ? await admin
          .from("profiles")
          .select("id, email, display_name")
          .in("id", ownerIds)
      : { data: [] };

    const vendorMap = new Map((vendors || []).map((v: any) => [v.id, v]));
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const normalizedProducts = (products || []).map((p: any) => ({
      ...p,
      vendors: vendorMap.get(p.vendor_id) || null,
      profiles: profileMap.get(p.owner_user_id) || null,
    }));

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
