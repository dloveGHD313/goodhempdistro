import { createSupabaseServerClient } from "@/lib/supabase";

type ProductSearchFilters = {
  maxPriceCents?: number | null;
  limit?: number;
};

export type MascotProductResult = {
  title: string;
  subtitle?: string | null;
  href: string;
  meta?: string | null;
  imageUrl?: string | null;
};

export async function searchProducts(
  query: string,
  filters: ProductSearchFilters = {}
): Promise<MascotProductResult[]> {
  const supabase = await createSupabaseServerClient();
  const limit = Math.min(filters.limit || 6, 12);

  let productQuery = supabase
    .from("products")
    .select("id, name, price_cents, vendor_id")
    .eq("status", "approved")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (query) {
    productQuery = productQuery.ilike("name", `%${query}%`);
  }

  if (typeof filters.maxPriceCents === "number") {
    productQuery = productQuery.lte("price_cents", filters.maxPriceCents);
  }

  const { data, error } = await productQuery;
  if (error || !data) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[mascot] searchProducts error", error);
    }
    return [];
  }

  const vendorIds = Array.from(new Set(data.map((item) => item.vendor_id).filter(Boolean))) as string[];
  let vendorMap: Record<string, string> = {};
  if (vendorIds.length > 0) {
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, business_name")
      .in("id", vendorIds);
    vendorMap = (vendors || []).reduce<Record<string, string>>((acc, vendor) => {
      if (vendor?.id) {
        acc[vendor.id] = vendor.business_name || "Verified Vendor";
      }
      return acc;
    }, {});
  }

  return data.map((product) => {
    const priceLabel =
      typeof product.price_cents === "number" && Number.isFinite(product.price_cents)
        ? `$${(product.price_cents / 100).toFixed(2)}`
        : "Price unavailable";
    return {
      title: product.name,
      subtitle: product.vendor_id ? vendorMap[product.vendor_id] : null,
      href: `/products/${product.id}`,
      meta: priceLabel,
    };
  });
}
