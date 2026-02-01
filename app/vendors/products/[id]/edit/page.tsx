import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getCategories } from "@/lib/categories";
import { isAdminEmail } from "@/lib/admin";
import Footer from "@/components/Footer";
import EditProductForm from "./EditProductForm";

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
  owner_user_id?: string;
  vendor_id?: string;
};

type NotFoundReason = "SESSION_MISSING" | "ACCESS_DENIED" | "NOT_FOUND" | "INVALID_ID";

async function getProductForEdit(
  productId: string,
  userId: string,
  isAdmin: boolean
): Promise<{ product: ProductRow } | { notFound: NotFoundReason }> {
  const supabase = await createSupabaseServerClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("id, name, description, price_cents, category_id, active, product_type, coa_url, coa_object_path, delta8_disclaimer_ack, owner_user_id, vendor_id")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    console.error("[vendors/products/edit] fetch error", { productId, error: error.message });
    return { notFound: "NOT_FOUND" };
  }

  if (!product) {
    return { notFound: "NOT_FOUND" };
  }

  const isOwner = product.owner_user_id === userId;
  let viaVendor = false;
  if (!isOwner && product.vendor_id) {
    const { data: v } = await supabase
      .from("vendors")
      .select("owner_user_id")
      .eq("id", product.vendor_id)
      .maybeSingle();
    viaVendor = v?.owner_user_id === userId;
  }
  const owns = isOwner || viaVendor;

  if (!owns && !isAdmin) {
    return { notFound: "ACCESS_DENIED" };
  }

  return { product };
}

function NotFoundContent({ reason, productId }: { reason: NotFoundReason; productId?: string }) {
  const messages: Record<NotFoundReason, string> = {
    SESSION_MISSING: "Your session may have expired. Please sign in again.",
    ACCESS_DENIED: "You do not have permission to edit this product. It may belong to another vendor.",
    NOT_FOUND: "Product not found. It may have been deleted or the link could be invalid.",
    INVALID_ID: "Invalid product link. Please use the Edit button from your products list.",
  };
  const detail = messages[reason];

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto surface-card p-8 text-center">
            <h1 className="text-2xl font-semibold mb-2 text-accent">Product not found</h1>
            <p className="text-muted mb-4">{detail}</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/vendors/products" className="btn-primary">
                Back to Products
              </Link>
              <Link href="/vendors/dashboard" className="btn-secondary">
                Dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();

  const { id: rawId } = await params;
  const productId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  if (!productId) {
    return <NotFoundContent reason="INVALID_ID" />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`/login?redirect=${encodeURIComponent(`/vendors/products/${productId}/edit`)}`);
  }

  const isAdmin = isAdminEmail(user.email);
  const result = await getProductForEdit(productId, user.id, isAdmin);

  if ("notFound" in result) {
    return <NotFoundContent reason={result.notFound} productId={productId} />;
  }

  const categories = await getCategories();

  return (
    <EditProductForm
      productId={productId}
      initialProduct={result.product}
      initialCategories={categories}
    />
  );
}
