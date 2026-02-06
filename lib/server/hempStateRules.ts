export type HempStateRule = {
  state_code?: string | null;
  sale_allowed?: boolean | null;
  intoxicating_sale_allowed?: boolean | null;
  non_intoxicating_sale_allowed?: boolean | null;
  delivery_allowed?: boolean | null;
  intoxicating_delivery_allowed?: boolean | null;
  non_intoxicating_delivery_allowed?: boolean | null;
};

export function isSaleAllowedForCategory(rule: HempStateRule | null, isIntoxicating: boolean): boolean {
  if (!rule) return true;
  if (isIntoxicating) {
    if (typeof rule.intoxicating_sale_allowed === "boolean") return rule.intoxicating_sale_allowed;
  } else if (typeof rule.non_intoxicating_sale_allowed === "boolean") {
    return rule.non_intoxicating_sale_allowed;
  }
  if (typeof rule.sale_allowed === "boolean") return rule.sale_allowed;
  return true;
}

export function isDeliveryAllowedForCategory(rule: HempStateRule | null, isIntoxicating: boolean): boolean {
  if (!rule) return true;
  if (isIntoxicating) {
    if (typeof rule.intoxicating_delivery_allowed === "boolean") return rule.intoxicating_delivery_allowed;
  } else if (typeof rule.non_intoxicating_delivery_allowed === "boolean") {
    return rule.non_intoxicating_delivery_allowed;
  }
  if (typeof rule.delivery_allowed === "boolean") return rule.delivery_allowed;
  return true;
}
