/**
 * Buy-button gate for the product detail page — pure, testable.
 *
 * P0 (storefront audit 2026-07-10): the COA requirement gates purchase only
 * when the product's CATEGORY requires a COA (categories.requires_coa SSOT,
 * GATE-03). The previous inline logic demanded an uploaded COA on EVERY
 * product, which made COA-exempt apparel (Clothing, requires_coa=false)
 * unbuyable with "COA required before purchase."
 */

export type BuyGateInput = {
  stripeEnabled: boolean;
  hasPriceCents: boolean;
  /** Does the product have any COA file/link uploaded? */
  hasCoa: boolean;
  /** categories.requires_coa for the product's category (SSOT). */
  categoryRequiresCoa: boolean;
  isApprovedActive: boolean;
};

export type BuyGateResult = {
  disabled: boolean;
  /** Message for the disabled buy button; null when buyable. */
  buyButtonMessage: string | null;
  /** Banner message near the price; null when buyable. */
  availabilityMessage: string | null;
};

export function evaluateBuyGate(input: BuyGateInput): BuyGateResult {
  const coaSatisfied = !input.categoryRequiresCoa || input.hasCoa;
  const disabled =
    !input.stripeEnabled || !input.hasPriceCents || !coaSatisfied || !input.isApprovedActive;

  const reason = !coaSatisfied
    ? "coa"
    : !input.hasPriceCents
      ? "price"
      : !input.stripeEnabled
        ? "stripe"
        : !input.isApprovedActive
          ? "unavailable"
          : null;

  const buyButtonMessage =
    reason === "coa"
      ? "COA required before purchase."
      : reason === "price"
        ? "Price unavailable."
        : reason === "stripe"
          ? "Checkout is not configured."
          : reason === "unavailable"
            ? "Product unavailable."
            : null;

  const availabilityMessage =
    reason === "coa"
      ? "COA required before purchase."
      : reason === "price"
        ? "Price unavailable."
        : reason === "stripe"
          ? "Checkout is not configured."
          : reason === "unavailable"
            ? "This product is not currently available."
            : null;

  return { disabled, buyButtonMessage, availabilityMessage };
}
