// Vendor categorization is DERIVED from their products' categories,
// not stored. At 120 vendors this is fast enough. If vendor count grows
// substantially, consider a vendor_categories materialized view.

import type { SupabaseClient } from "@supabase/supabase-js";

export type RecommendedVendor = {
  id: string;
  business_name: string;
  tagline: string | null;
  matchedCategories: string[];
};

type VendorRow = {
  id: string;
  business_name: string | null;
  tagline: string | null;
  status: string | null;
  is_approved: boolean | null;
  updated_at: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
};

type ProductRow = {
  vendor_id: string | null;
  category_id: string | null;
};

function normalizeInterest(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, "-");
}

/**
 * Returns up to `limit` vendors whose products match the user's
 * shopping interests. Falls back to legacy consumer_interest_tags +
 * consumer_use_case when shopping_interests is empty.
 *
 * Scoring: number of matched categories first, then most recently
 * updated. Only active + approved vendors with at least one matching
 * product are returned.
 */
export async function getRecommendedVendors(
  userId: string,
  supabase: SupabaseClient,
  limit = 5
): Promise<RecommendedVendor[]> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("shopping_interests, consumer_interest_tags, consumer_use_case")
      .eq("id", userId)
      .maybeSingle();

    const interests = collectInterests(profile);
    if (interests.length === 0) return [];

    const matchedCategories = await matchCategoriesByInterest(supabase, interests);
    if (matchedCategories.length === 0) return [];

    const categoryIds = matchedCategories.map((c) => c.id);

    const { data: productRows } = await supabase
      .from("products")
      .select("vendor_id, category_id")
      .eq("status", "approved")
      .eq("active", true)
      .in("category_id", categoryIds);

    const products = (productRows ?? []) as ProductRow[];
    const vendorIdToCategoryNames = new Map<string, Set<string>>();
    const categoryNameById = new Map(matchedCategories.map((c) => [c.id, c.name]));

    for (const product of products) {
      if (!product.vendor_id || !product.category_id) continue;
      const name = categoryNameById.get(product.category_id);
      if (!name) continue;
      let set = vendorIdToCategoryNames.get(product.vendor_id);
      if (!set) {
        set = new Set();
        vendorIdToCategoryNames.set(product.vendor_id, set);
      }
      set.add(name);
    }

    const vendorIds = Array.from(vendorIdToCategoryNames.keys());
    if (vendorIds.length === 0) return [];

    const { data: vendorRows } = await supabase
      .from("vendors")
      .select("id, business_name, tagline, status, is_approved, updated_at")
      .in("id", vendorIds)
      .eq("status", "active")
      .eq("is_approved", true);

    const vendors = (vendorRows ?? []) as VendorRow[];

    return vendors
      .map((v) => ({
        id: v.id,
        business_name: v.business_name ?? "Verified Vendor",
        tagline: v.tagline,
        matchedCategories: Array.from(vendorIdToCategoryNames.get(v.id) ?? []),
        _updatedAt: v.updated_at ?? "",
      }))
      .sort((a, b) => {
        if (a.matchedCategories.length !== b.matchedCategories.length) {
          return b.matchedCategories.length - a.matchedCategories.length;
        }
        return b._updatedAt.localeCompare(a._updatedAt);
      })
      .slice(0, limit)
      .map(({ _updatedAt: _, ...rest }) => rest);
  } catch {
    return [];
  }
}

function collectInterests(profile: {
  shopping_interests?: string[] | null;
  consumer_interest_tags?: string[] | null;
  consumer_use_case?: string | null;
} | null): string[] {
  if (!profile) return [];
  const out: string[] = [];
  if (Array.isArray(profile.shopping_interests)) out.push(...profile.shopping_interests);
  if (out.length > 0) return Array.from(new Set(out.map(normalizeInterest)));
  if (Array.isArray(profile.consumer_interest_tags)) out.push(...profile.consumer_interest_tags);
  if (typeof profile.consumer_use_case === "string" && profile.consumer_use_case.trim().length > 0) {
    out.push(profile.consumer_use_case);
  }
  return Array.from(new Set(out.map(normalizeInterest)));
}

async function matchCategoriesByInterest(
  supabase: SupabaseClient,
  interests: string[]
): Promise<CategoryRow[]> {
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug");
  const all = (data ?? []) as CategoryRow[];

  const matched: CategoryRow[] = [];
  for (const category of all) {
    const haystack = `${normalizeInterest(category.name)} ${normalizeInterest(category.slug)}`;
    if (interests.some((interest) => haystack.includes(interest))) {
      matched.push(category);
    }
  }
  return matched;
}
