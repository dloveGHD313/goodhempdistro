import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import AdminProductDetailClient from "./AdminProductDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category_id: string | null;
  active: boolean;
  product_type?: string;
  coa_url?: string | null;
  coa_object_path?: string | null;
  delta8_disclaimer_ack?: boolean;
  status?: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  vendor_id?: string | null;
  owner_user_id?: string | null;
};

async function fetchProductForAdmin(
  productId: string,
  baseUrl: string,
  cookieHeader: string
): Promise<
  | { status: 200; product: ProductRow }
  | { status: 401 | 403 | 404 | 500; error: string; code?: string }
> {
  const url = baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/vendors/products/${productId}` : "";
  if (!url) return { status: 500, error: "Unable to determine site URL" };
  const res = await fetch(url, { headers: { cookie: cookieHeader }, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (res.status === 200 && json?.product) {
    return { status: 200, product: json.product as ProductRow };
  }
  return {
    status: res.status as 401 | 403 | 404 | 500,
    error: json?.error || "Failed to load product",
    code: json?.code,
  };
}

function ErrorContent({ heading, detail }: { heading: string; detail: string }) {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto surface-card p-8 text-center">
            <h1 className="text-2xl font-semibold mb-2 text-accent">{heading}</h1>
            <p className="text-muted mb-4">{detail}</p>
            <Link href="/admin/products" className="btn-primary">
              Back to Product Review
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/products");
  }
  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const { id: rawId } = await params;
  const productId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";
  if (!productId) {
    return (
      <ErrorContent
        heading="Invalid product"
        detail="Use the product list to open a product."
      />
    );
  }

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? hdrs.get("x-forwarded-protocol") ?? "https";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  const cookieHeader = hdrs.get("cookie") ?? "";

  const result = await fetchProductForAdmin(productId, baseUrl, cookieHeader);

  if (result.status === 401) {
    redirect(`/login?redirect=${encodeURIComponent(`/admin/products/${productId}`)}`);
  }
  if (result.status === 403 || result.status === 404) {
    return (
      <ErrorContent
        heading={result.status === 404 ? "Product not found" : "Access denied"}
        detail={result.error}
      />
    );
  }
  if (result.status === 500) {
    return <ErrorContent heading="Error loading product" detail={result.error} />;
  }
  if (result.status !== 200 || !("product" in result)) {
    return <ErrorContent heading="Product not found" detail="The product may have been deleted." />;
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <AdminProductDetailClient productId={productId} initialProduct={result.product} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
