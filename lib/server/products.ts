import { createSupabaseServerClient } from "@/lib/supabase";
import { getCategoriesCoaRequirementMap } from "@/lib/compliance";

export type Product = {
  id: string;
  name: string;
  category_id: string | null;
  price_cents: number;
  is_gated: boolean;
  market_category: string | null;
  market_mode: "gated" | "ungated";
  featured: boolean;
  description?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  /** When true, category requires COA (Phase 3B: logged-out shop hides these). */
  category_requires_coa?: boolean;
};

export async function getProducts(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  vendorId?: string | null,
  includeGated = false,
  /** When true, only return products whose category does NOT require COA. */
  publicShopOnly = false
): Promise<{
  products: Product[];
  vendorName?: string | null;
  productsLookupFailed: boolean;
}> {
  try {
    let vendorName: string | null = null;
    if (vendorId) {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, business_name, status")
        .eq("id", vendorId)
        .maybeSingle();

      if (!vendor || vendor.status !== "active") {
        return { products: [], vendorName: null, productsLookupFailed: false };
      }
      vendorName = vendor.business_name;
    }

    let query = supabase
      .from("products")
      .select("id, name, category_id, price_cents, is_gated, market_category, featured, description, vendor_id")
      .eq("status", "approved")
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (!includeGated) {
      query = query.eq("is_gated", false);
    }
    if (vendorId) {
      query = query.eq("vendor_id", vendorId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[products] Error fetching products:", error);
      return { products: [], vendorName, productsLookupFailed: true };
    }

    const rawProducts = data || [];
    const withVendor = rawProducts.filter((p) => p.vendor_id != null && String(p.vendor_id).trim() !== "");
    const vendorIds = Array.from(new Set(withVendor.map((p) => p.vendor_id).filter(Boolean))) as string[];

    const vendorMap: Record<string, string> = {};
    const activeVendorIds = new Set<string>();
    let vendorStatusLookupOk = true;
    if (vendorIds.length > 0) {
      const { data: vendors, error: vendorError } = await supabase
        .from("vendors")
        .select("id, business_name, status")
        .in("id", vendorIds);
      if (vendorError) {
        vendorStatusLookupOk = false;
        console.warn("[products] Vendor status lookup failed; skipping active-vendor filter", {
          code: vendorError.code,
          message: vendorError.message?.slice(0, 100),
        });
      } else {
        (vendors || []).forEach((v) => {
          if (v?.id && v?.status === "active") {
            activeVendorIds.add(v.id);
            vendorMap[v.id] = v.business_name || "Verified Vendor";
          }
        });
      }
    }

    const visibleProducts = vendorStatusLookupOk
      ? withVendor.filter((p) => p.vendor_id && activeVendorIds.has(p.vendor_id))
      : withVendor;

    const categoryIds = Array.from(
      new Set(
        visibleProducts
          .map((p) => p.category_id)
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      )
    );
    const coaMap = await getCategoriesCoaRequirementMap(supabase, categoryIds);

    let products: Product[] = visibleProducts.map((product) => {
      const marketMode: "gated" | "ungated" =
        product.is_gated ||
        product.market_category === "RECREATIONAL" ||
        product.market_category === "INTOXICATING"
          ? "gated"
          : "ungated";
      const categoryRequiresCoa =
        product.category_id != null && product.category_id.trim() !== ""
          ? coaMap[product.category_id] ?? true
          // Default to true (COA required) when category is missing —
          // intentional: uncategorised products are hidden from the public
          // shop to prevent unverified items from being shown to guests.
          : true;
      return {
        ...product,
        market_mode: marketMode,
        vendor_name: vendorName || (product.vendor_id ? vendorMap[product.vendor_id] : null) || null,
        category_requires_coa: categoryRequiresCoa,
      };
    });

    if (publicShopOnly) {
      products = products.filter((p) => p.category_requires_coa !== true);
    }

    return { products, vendorName, productsLookupFailed: false };
  } catch (err) {
    console.error("[products] Fatal error fetching products:", err);
    return { products: [], vendorName: null, productsLookupFailed: true };
  }
}
