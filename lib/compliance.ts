/**
 * Compliance helpers for product types, COAs, and intoxicating product cutoff.
 *
 * COA SSOT (post GATE-03 cutover): the `categories.requires_coa` column is
 * the single source of truth. The hardcoded slug allowlist that previously
 * lived here was removed; admins now manage COA rules via the DB.
 *
 * Compliance-safe failure mode: when a category cannot be resolved (unknown
 * id, missing slug, RLS hiding a row), requiresCOA() defaults to TRUE and
 * emits a console.warn. This matches the previous "unknown → require COA"
 * behavior while making missing-category bugs surface in logs.
 */

const INTOXICATING_ALLOWED_UNTIL = process.env.INTOXICATING_ALLOWED_UNTIL || "2026-11-01";

export type ProductType = "non_intoxicating" | "intoxicating" | "delta8";

/** Category shape consumed by requiresCOA. requires_coa is the SSOT field. */
export interface ProductCategoryInfo {
  slug?: string | null;
  name?: string | null;
  /** SSOT — when undefined, requiresCOA defaults TRUE and warns. */
  requires_coa?: boolean | null;
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
 * Single source of truth: does this product category require a full-panel COA?
 *
 * Reads `categories.requires_coa` directly. Defaults to TRUE when the category
 * is null/undefined or has no `requires_coa` value — safe failure mode.
 * Emits a console.warn so missing-category bugs surface in logs.
 *
 * @param productCategory - { slug, name, requires_coa } from the categories table
 */
export function requiresCOA(
  productCategory: ProductCategoryInfo | null | undefined,
  _productType?: string | null
): boolean {
  if (!productCategory) {
    console.warn(
      `[compliance] Category lookup returned null/undefined — defaulting requires_coa=true. ` +
      `Check that the product has a valid category_id and the categories row exists.`
    );
    return true;
  }
  if (typeof productCategory.requires_coa === "boolean") {
    return productCategory.requires_coa;
  }
  // Field is null or undefined on the category row — treat as unknown.
  const slug = productCategory.slug ?? "(unknown)";
  console.warn(
    `[compliance] Unknown category slug "${slug}" — defaulting ` +
    `requires_coa=true. Add this category to the categories table ` +
    `or correct the product's category reference.`
  );
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
 * Server-side: determine if a category requires COA by ID, reading the
 * `categories.requires_coa` SSOT column directly. Returns true when:
 *   - categoryId is null/empty (unknown → safe default)
 *   - category row doesn't exist (unknown → safe default + warn)
 *   - the category's requires_coa column is set true
 *
 * Returns false only when the resolved row explicitly has requires_coa = false.
 *
 * Parent-category override (compliance loosening): only kicks in when the
 * child's requires_coa is true AND its parent's requires_coa is explicitly
 * false. This preserves the prior behavior where parent categories could
 * opt their children out of COA. (Today no such configuration exists, but
 * the override is kept available for future use.)
 *
 * @param supabase - Supabase client (server or route handler)
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
    .select("id, name, slug, parent_id, requires_coa")
    .eq("id", categoryId.trim())
    .maybeSingle();
  if (!category) {
    return true;
  }
  let result = requiresCOA({
    slug: category.slug,
    name: category.name,
    requires_coa: category.requires_coa,
  });
  if (category.parent_id && result) {
    const { data: parent } = await supabase
      .from("categories")
      .select("slug, name, requires_coa")
      .eq("id", category.parent_id)
      .maybeSingle();
    if (parent && parent.requires_coa === false) {
      result = false;
    }
  }
  return result;
}

/**
 * Batch version: returns a map of category id -> whether that category requires COA.
 * Reads categories.requires_coa as SSOT. Unknown/missing IDs default to true
 * (safe failure mode + console.warn via requiresCOA helper).
 *
 * @param supabase - Supabase client (server or route handler)
 * @param categoryIds - non-null category IDs to look up
 */
export async function getCategoriesCoaRequirementMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoids deep Supabase generic instantiation
  supabase: any,
  categoryIds: string[]
): Promise<Record<string, boolean>> {
  const unique = Array.from(new Set(categoryIds.filter((id) => typeof id === "string" && id.trim().length > 0)));
  if (unique.length === 0) return {};

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, requires_coa")
    .in("id", unique);

  type CategoryRow = {
    id: string;
    name?: string | null;
    slug?: string | null;
    parent_id?: string | null;
    requires_coa?: boolean | null;
  };

  const list = (categories || []) as CategoryRow[];
  const parentIds = Array.from(
    new Set(list.map((c) => c.parent_id).filter((id): id is string => typeof id === "string" && id.trim().length > 0))
  );
  let parents: CategoryRow[] = [];
  if (parentIds.length > 0) {
    const { data: parentRows } = await supabase
      .from("categories")
      .select("id, slug, name, requires_coa")
      .in("id", parentIds);
    parents = (parentRows || []) as CategoryRow[];
  }
  const parentMap = Object.fromEntries(parents.map((p) => [p.id, p]));

  const map: Record<string, boolean> = {};
  for (const id of unique) {
    map[id] = true; // default when category not in list (safe failure)
  }
  for (const cat of list) {
    let result = requiresCOA({
      slug: cat.slug,
      name: cat.name,
      requires_coa: cat.requires_coa,
    });
    if (cat.parent_id && result) {
      const parent = parentMap[cat.parent_id];
      if (parent && parent.requires_coa === false) {
        result = false;
      }
    }
    map[cat.id] = result;
  }
  return map;
}
