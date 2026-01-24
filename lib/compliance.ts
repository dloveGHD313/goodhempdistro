/**
 * Compliance helpers for product types, COAs, and intoxicating product cutoff
 */

const INTOXICATING_ALLOWED_UNTIL = process.env.INTOXICATING_ALLOWED_UNTIL || "2026-11-01";

export type ProductType = "non_intoxicating" | "intoxicating" | "delta8";

export interface ProductCompliancePayload {
  product_type: ProductType;
  coa_url?: string | null;
  coa_object_path?: string | null;
  delta8_disclaimer_ack?: boolean;
  category_requires_coa?: boolean;
}

export interface ComplianceErrors {
  field: string;
  message: string;
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
 * Validate product compliance rules
 */
export function validateProductCompliance(payload: ProductCompliancePayload): ComplianceErrors[] {
  const errors: ComplianceErrors[] = [];

  // COA URL is required only if category requires it
  if (payload.category_requires_coa === true) {
    const hasCoaUrl = !!payload.coa_url && payload.coa_url.trim().length > 0;
    const hasCoaObjectPath =
      !!payload.coa_object_path && payload.coa_object_path.trim().length > 0;
    if (!hasCoaUrl && !hasCoaObjectPath) {
      errors.push({
        field: "coa_url",
        message: "COA is required for this product category",
      });
    }
  }

  // Intoxicating products are only allowed until cutoff date
  if (payload.product_type === "intoxicating" && !isIntoxicatingAllowedNow()) {
    errors.push({
      field: "product_type",
      message: `Intoxicating products are only allowed until ${getIntoxicatingCutoffDate()}. The cutoff date has passed.`,
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
