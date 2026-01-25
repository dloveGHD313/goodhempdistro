import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import ProductsReviewClient from "./ProductsReviewClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getPendingProducts() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/admin/products?status=pending_review&limit=50`,
      { cache: "no-store" }
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      console.error("[admin/products] Error fetching pending products:", payload);
      return {
        products: [],
        counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
        error: payload?.error || "Failed to load products",
      };
    }
    return {
      products: payload.data || [],
      counts: payload.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
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

  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/products");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const productsData = await getPendingProducts();

  console.log(
    `[admin/products] Admin ${adminCheck.user.id} viewing products. Pending: ${productsData.counts?.pending || 0}`
  );

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Product Review Queue</h1>
          <ProductsReviewClient 
            initialProducts={productsData.products || []} 
            initialCounts={productsData.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 }} 
            initialStatus="pending_review"
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
