import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getCategories } from "@/lib/categories";
import { getSiteUrl } from "@/lib/stripe";
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
};

type ErrorContentProps = {
  heading: string;
  detail: string;
};

function ErrorContent({ heading, detail }: ErrorContentProps) {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto surface-card p-8 text-center">
            <h1 className="text-2xl font-semibold mb-2 text-accent">{heading}</h1>
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

async function fetchProductViaApi(
  productId: string,
  cookieHeader: string,
  baseUrl: string
): Promise<
  | { status: 200; product: ProductRow }
  | { status: 401 | 403 | 404 | 500; error: string; code?: string }
> {
  const res = await fetch(`${baseUrl}/api/vendors/products/${productId}`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));

  if (res.status === 200) {
    const product = json?.product;
    if (!product) {
      return { status: 404, error: "Product not found", code: "NOT_FOUND" };
    }
    return { status: 200, product: product as ProductRow };
  }

  return {
    status: res.status as 401 | 403 | 404 | 500,
    error: json?.error || "Failed to load product",
    code: json?.code,
  };
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
    return (
      <ErrorContent
        heading="Product not found"
        detail="Invalid product link. Please use the Edit button from your products list."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`/login?redirect=${encodeURIComponent(`/vendors/products/${productId}/edit`)}`);
  }

  const hdrs = await headers();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  const baseUrl = getSiteUrl({ headers: hdrs });

  const result = await fetchProductViaApi(productId, cookieHeader, baseUrl);

  if (result.status === 401) {
    redirect(`/login?redirect=${encodeURIComponent(`/vendors/products/${productId}/edit`)}`);
  }

  if (result.status === 403) {
    return (
      <ErrorContent
        heading="Access denied"
        detail="You do not have permission to edit this product. It may belong to another vendor."
      />
    );
  }

  if (result.status === 404) {
    return (
      <ErrorContent
        heading="Product not found"
        detail="It may have been deleted or the link could be invalid."
      />
    );
  }

  if (result.status === 500) {
    return (
      <ErrorContent
        heading="Error loading product"
        detail={result.error}
      />
    );
  }

  if (result.status !== 200 || !("product" in result)) {
    return (
      <ErrorContent
        heading="Product not found"
        detail="It may have been deleted or the link could be invalid."
      />
    );
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
