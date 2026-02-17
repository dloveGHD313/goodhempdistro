/**
 * Compliance helpers for product types, COAs, and intoxicating product cutoff
 * Phase 2: COA required for hemp-derived/consumable/topical/inhalable/wellness/recreational/industrial;
 * COA NOT required only for: apparel, non-consumable home goods.
 */

const INTOXICATING_ALLOWED_UNTIL = process.env.INTOXICATING_ALLOWED_UNTIL || "2026-11-01";

/** Slugs/name fragments that do NOT require a COA (apparel, non-consumable home goods only) */
const COA_EXCEPTION_PATTERNS: string[] = [
  "textiles-apparel",
  "clothing",
  "fabric-yarn",
  "accessories",
  "apparel",
  "hats",
  "merch",
  "home-goods",
  "curtains",
  "blinds",
  "decor",
  "home-decor",
  "textiles",
];

export type ProductType = "non_intoxicating" | "intoxicating" | "delta8";

export interface ProductCategoryInfo {
  slug?: string | null;
  name?: string | null;
}

export interface ProductCompliancePayload {
  product_type: ProductType;
  coa_url?: string | null;
  coa_object_path?: string | null;
  delta8_disclaimer_ack?: boolean;
  category_requires_coa?: boolean;
  /** Required: must be true for all products (hemp-derived attestation). */
  hemp_derived_attestation?: boolean;
}

export interface ComplianceErrors {
  field: string;
  message: string;
}

/** "draft" = create/update must not block on COA; "submit" = enforce COA before publish. */
export type ValidateProductComplianceMode = "draft" | "submit";
export interface ValidateProductComplianceOptions {
  mode?: ValidateProductComplianceMode;
}

/**
 * Single source of truth: does this product category/type require a full-panel COA?
 * Returns true for hemp-derived, consumable, topical, inhalable, CBD/wellness, recreational, industrial.
 * Returns false ONLY for: apparel (clothing, hats, merch), non-consumable home goods (curtains, blinds, decor).
 * Use for UI validation, API validation, and server-side enforcement.
 */
export function requiresCOA(
  productCategory: ProductCategoryInfo | null | undefined,
  _productType?: string | null
): boolean {
  if (!productCategory) {
    return true; // unknown category → require COA for safety
  }
  const slug = (productCategory.slug ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  const name = (productCategory.name ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!slug && !name) {
    return true;
  }
  const combined = [slug, name].filter(Boolean).join(" ");
  for (const pattern of COA_EXCEPTION_PATTERNS) {
    if (slug === pattern || name === pattern) return false;
    if (slug.includes(pattern) || name.includes(pattern)) return false;
    if (combined.includes(pattern)) return false;
  }
  return true;
}

/**
 * Check if intoxicating products are currently allowed
 */
export function isIntoxicatingAllowedNow(): boolean {
  try {
    const cutoffDate = new Date(INTOXICATING_ALLOWED_UNTIL);
    const now = new Date();
    return now < cutoffDate;
  } catch {
    // If date parsing fails, default to false for safety
    return false;
  }
}

/**
 * Get the cutoff date for intoxicating products
 */
export function getIntoxicatingCutoffDate(): string {
  return INTOXICATING_ALLOWED_UNTIL;
}

/**
 * Get Delta-8 warning text
 */
export function getDelta8WarningText(): string {
  return "Warning: This Delta-8 product may contain heavy metals or harsh chemicals unless the vendor provides verified documentation of safe manufacturing processes. Use at your own discretion.";
}

/**
 * Validate product compliance rules.
 * mode "draft": create/update — do NOT block on COA (Phase 2). Hemp-derived attestation still required.
 * mode "submit": publish/submit — enforce COA when category_requires_coa.
 */
export function validateProductCompliance(
  payload: ProductCompliancePayload,
  options?: ValidateProductComplianceOptions
): ComplianceErrors[] {
  const mode = options?.mode ?? "draft";
  const errors: ComplianceErrors[] = [];

  // All products must attest hemp-derived (create/update)
  if (payload.hemp_derived_attestation !== true) {
    errors.push({
      field: "hemp_derived_attestation",
      message: "You must confirm this product is hemp-derived.",
    });
  }

  // COA blocking only in submit mode (Phase 2: create/update must not block on COA)
  if (mode === "submit" && payload.category_requires_coa) {
    const hasCoaUrl = typeof payload.coa_url === "string" && payload.coa_url.trim().length > 0;
    const hasCoaPath = typeof payload.coa_object_path === "string" && payload.coa_object_path.trim().length > 0;
    if (!hasCoaUrl && !hasCoaPath) {
      errors.push({
        field: "coa",
        message: "A COA (Certificate of Analysis) upload or link is required for this category.",
      });
    }
  }

  // Recreational (intoxicating) products are only allowed until cutoff date
  if (payload.product_type === "intoxicating" && !isIntoxicatingAllowedNow()) {
    errors.push({
      field: "product_type",
      message: `Recreational products are only allowed until ${getIntoxicatingCutoffDate()}. The cutoff date has passed.`,
    });
  }

  // Delta-8 products require disclaimer acknowledgement
  if (payload.product_type === "delta8" && !payload.delta8_disclaimer_ack) {
    errors.push({
      field: "delta8_disclaimer_ack",
      message: "Delta-8 disclaimer acknowledgement is required",
    });
  }

  return errors;
}

/**
 * Check if a product type requires a warning/disclaimer
 */
export function requiresWarning(productType: ProductType): boolean {
  return productType === "delta8";
}

/**
 * Server-side: determine if a category requires COA by ID.
 * Fetches category, calls requiresCOA; if child category and category requires COA, also checks parent.
 * Returns true when categoryId is null/undefined (unknown → require COA for safety).
 *
 * @param supabase - Supabase client (server or route handler) with from().select().eq().maybeSingle()
 */
export async function getCategoryCoaRequirement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoids deep Supabase generic instantiation
  supabase: any,
  categoryId: string | null | undefined
): Promise<boolean> {
  if (!categoryId || typeof categoryId !== "string" || !categoryId.trim()) {
    return true;
  }
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id")
    .eq("id", categoryId.trim())
    .maybeSingle();
  if (!category) {
    return true;
  }
  let result = requiresCOA({ slug: category.slug, name: category.name });
  if (category.parent_id && result) {
    const { data: parent } = await supabase
      .from("categories")
      .select("slug, name")
      .eq("id", category.parent_id)
      .maybeSingle();
    if (parent && !requiresCOA({ slug: parent.slug, name: parent.name })) {
      result = false;
    }
  }
  return result;
}
