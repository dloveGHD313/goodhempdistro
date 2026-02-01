import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import ProductQueueClient from "./ProductQueueClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getQueueProducts() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/admin/products?status=pending_review&limit=100&sort=oldest_first`,
      { cache: "no-store" }
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      return { products: [], error: payload?.error || "Failed to load queue" };
    }
    return { products: payload.data || [], error: null };
  } catch (err) {
    console.error("[admin/products/queue] fetch error", err);
    return { products: [], error: "Failed to load queue" };
  }
}

export default async function AdminProductQueuePage() {
  noStore();
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/products/queue");
  }
  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const { products, error } = await getQueueProducts();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold text-accent">Product Queue</h1>
            <Link href="/admin/products" className="btn-secondary">
              ← All Products
            </Link>
          </div>
          <p className="text-muted mb-4">
            Pending review (oldest first). Approve, reject, or delete from here or use bulk actions.
          </p>
          <ProductQueueClient initialProducts={products} initialError={error} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
