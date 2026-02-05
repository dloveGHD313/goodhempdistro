import { createSupabaseServerClient } from "@/lib/supabase";

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export type DeliveryPricingRow = {
  id: string;
  is_active: boolean;
  base_fee_customer: number;
  per_mile_customer: number;
  minimum_miles: number;
  base_pay_driver: number;
  per_mile_driver: number;
  version: string;
};

/**
 * Load active delivery pricing from DB (single active row).
 */
export async function getActiveDeliveryPricing(): Promise<DeliveryPricingRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("delivery_pricing")
    .select("id, is_active, base_fee_customer, per_mile_customer, minimum_miles, base_pay_driver, per_mile_driver, version")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as DeliveryPricingRow;
}

/**
 * Compute customer-facing delivery fee (billable miles = max(0, distance - minimum_miles)).
 */
export function computeCustomerDeliveryFee(
  pricing: DeliveryPricingRow,
  distanceMiles: number
): number {
  const billable = Math.max(0, distanceMiles - pricing.minimum_miles);
  const fee = pricing.base_fee_customer + billable * pricing.per_mile_customer;
  return Math.round(fee * 100) / 100;
}

/**
 * Compute driver payout estimate (same billable miles logic).
 */
export function computeDriverDeliveryEstimate(
  pricing: DeliveryPricingRow,
  distanceMiles: number
): number {
  const billable = Math.max(0, distanceMiles - pricing.minimum_miles);
  const pay = pricing.base_pay_driver + billable * pricing.per_mile_driver;
  return Math.round(pay * 100) / 100;
}

/**
 * Platform margin = customer fee - driver estimate (admin-only visibility).
 */
export function computeDeliveryMargin(customerFee: number, driverEstimate: number): number {
  return Math.round((customerFee - driverEstimate) * 100) / 100;
}

/**
 * Haversine distance in miles between two points.
 */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth radius miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export type DeliveryFees = {
  distanceMiles: number;
  deliveryFeeCustomer: number;
  deliveryFeeDriverEstimate: number;
  deliveryMargin: number;
  pricingVersion: string;
};

/**
 * Compute all delivery amounts from distance and active pricing.
 * Returns null for invalid distance (NaN, Infinity, negative) or missing pricing.
 */
export async function computeDeliveryFees(distanceMiles: number): Promise<DeliveryFees | null> {
  const pricing = await getActiveDeliveryPricing();
  if (!pricing) return null;
  if (!isFiniteNonNegative(distanceMiles)) return null;

  const customerFee = computeCustomerDeliveryFee(pricing, distanceMiles);
  const driverEstimate = computeDriverDeliveryEstimate(pricing, distanceMiles);
  const margin = computeDeliveryMargin(customerFee, driverEstimate);

  if (![customerFee, driverEstimate, margin].every(Number.isFinite)) return null;

  return {
    distanceMiles,
    deliveryFeeCustomer: customerFee,
    deliveryFeeDriverEstimate: driverEstimate,
    deliveryMargin: margin,
    pricingVersion: pricing.version,
  };
}
