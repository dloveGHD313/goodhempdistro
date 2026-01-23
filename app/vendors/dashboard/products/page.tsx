import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import ProductsClient from "@/app/vendors/products/ProductsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getVendorProducts(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, owner_user_id, vendor_onboarding_completed, terms_accepted_at, compliance_acknowledged_at")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (!vendor) {
      return null;
    }

    if (
      !vendor.vendor_onboarding_completed ||
      !vendor.terms_accepted_at ||
      !vendor.compliance_acknowledged_at
    ) {
      redirect("/onboarding/vendor");
    }

    const { data: products, error } = await supabase
      .from("products")
      .select(
        "id, name, description, price_cents, status, active, category_id, submitted_at, reviewed_at, rejection_reason, created_at"
      )
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[vendors/dashboard/products] Error fetching products:", error);
      return { products: [], error: error.message };
    }

    const drafts = (products || []).filter((p) => p.status === "draft");
    const pending = (products || []).filter((p) => p.status === "pending_review");
    const approved = (products || []).filter((p) => p.status === "approved");
    const rejected = (products || []).filter((p) => p.status === "rejected");

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
    console.error("[vendors/dashboard/products] Error in getVendorProducts:", err);
    return {
      products: [],
      counts: { draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 },
    };
  }
}

export default async function VendorDashboardProductsPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/dashboard/products");
  }

  const productsData = await getVendorProducts(user.id);

  if (!productsData) {
    redirect("/vendor-registration");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Product Listings</h1>
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
