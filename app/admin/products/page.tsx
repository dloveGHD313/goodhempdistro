import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import ProductsReviewClient from "./ProductsReviewClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_STATUSES = ["pending_review", "approved", "rejected", "draft"] as const;

async function getProductsSummary() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/admin/products?summary=1`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      console.error("[admin/products] Error fetching product summary:", payload);
      return {
        counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
        suggestedDefaultStatus: "pending_review",
      };
    }
    return {
      counts: payload.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
      suggestedDefaultStatus: payload.suggestedDefaultStatus || "pending_review",
    };
  } catch (err) {
    console.error("[admin/products] Error in getProductsSummary:", err);
    return {
      counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
      suggestedDefaultStatus: "pending_review",
    };
  }
}

async function getPendingProducts(status: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/admin/products?status=${status}&limit=50`,
      { cache: "no-store" }
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      console.error("[admin/products] Error fetching products:", payload);
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
    console.error("[admin/products] Error in getProductsByStatus:", err);
    return {
      products: [],
      counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
    };
  }
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  noStore();

  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/products");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const summary = await getProductsSummary();
  const requestedStatus = searchParams?.status;
  const initialStatus = VALID_STATUSES.includes(requestedStatus as (typeof VALID_STATUSES)[number])
    ? (requestedStatus as (typeof VALID_STATUSES)[number])
    : summary.suggestedDefaultStatus;

  const productsData = await getPendingProducts(initialStatus);

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
            initialCounts={productsData.counts || summary.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 }} 
            initialStatus={initialStatus}
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
