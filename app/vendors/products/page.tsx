import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import ProductsClient from "./ProductsClient";
import { getCategoryComplianceMap } from "@/lib/compliance/categoryCompliance";
import { evaluateFederal2026Compliance } from "@/lib/compliance/federal2026";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getVendorProducts(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Get vendor
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

    // Get all products for this vendor (all statuses)
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, description, price_cents, status, active, category_id, submitted_at, reviewed_at, rejection_reason, created_at, total_thc_percent, total_thc_mg_per_container, contains_synthesized_cannabinoids")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[vendors/products] Error fetching products:", error);
      return { products: [], error: error.message };
    }

    // Federal 2026 status per product (P.L. 119-37, effective 2026-12-11 per H.R. 6500) —
    // warning display only; enforcement stays behind ENFORCE_FEDERAL_2026.
    const categoryIds = Array.from(
      new Set((products || []).map((p) => p.category_id).filter((id): id is string => !!id))
    );
    const complianceMap = await getCategoryComplianceMap(supabase, categoryIds);
    const withFederal = (products || []).map((p) => ({
      ...p,
      federal_2026_status: evaluateFederal2026Compliance({
        total_thc_percent: p.total_thc_percent,
        total_thc_mg_per_container: p.total_thc_mg_per_container,
        contains_synthesized_cannabinoids: p.contains_synthesized_cannabinoids,
        categoryRequiresCoa: p.category_id
          ? complianceMap[p.category_id]?.requiresCoa ?? true
          : true,
      }),
    }));

    // Group by status
    const drafts = withFederal.filter(p => p.status === 'draft');
    const pending = withFederal.filter(p => p.status === 'pending_review');
    const approved = withFederal.filter(p => p.status === 'approved');
    const rejected = withFederal.filter(p => p.status === 'rejected');

    return {
      products: withFederal,
      counts: {
        draft: drafts.length,
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        total: withFederal.length,
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
              {/* FIXED: Use Link for client-side navigation */}
              <Link href="/vendors/dashboard" className="btn-secondary">
                Back to Dashboard
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
