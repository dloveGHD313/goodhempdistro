#!/usr/bin/env node
/**
 * Phase 5 — Checkout delivery validation (manual/CI).
 * Run against local dev: npm run dev, then node scripts/phase5-checkout-delivery-validate.mjs
 * Or use the curl examples below against your deployed API (with auth cookie).
 *
 * Expectations:
 * - POST with delivery_selected: true and NaN/Infinity coords or invalid distance -> 400, no session.
 * - POST with delivery_selected: true and valid coords or valid delivery_distance_miles -> 200, session has Delivery fee line item when fee > 0.
 */

const BASE = process.env.CHECKOUT_BASE_URL || "http://localhost:3000";

function exampleCurl(label, body) {
  console.log(`\n# ${label}`);
  console.log(`curl -s -X POST "${BASE}/api/checkout/create-session" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -H "Cookie: <sb-auth-token>" \\`);
  console.log(`  -d '${JSON.stringify(body)}'`);
}

console.log("Phase 5 — Checkout delivery validation");
console.log("========================================");
console.log("Base URL:", BASE);
console.log("\n1) NaN coords should 400 (Distance unavailable for delivery):");
exampleCurl("NaN vendor_lat", {
  product_id: "<valid-product-uuid>",
  quantity: 1,
  delivery_selected: true,
  vendor_lat: NaN,
  vendor_lng: -122.4,
  customer_lat: 37.8,
  customer_lng: -122.4,
});

console.log("\n2) Valid delivery_distance_miles should succeed (200 + session with delivery line item):");
exampleCurl("Valid distance", {
  product_id: "<valid-product-uuid>",
  quantity: 1,
  delivery_selected: true,
  delivery_distance_miles: 5,
});

console.log("\n3) Valid coords should compute distance and add delivery fee:");
exampleCurl("Valid coords", {
  product_id: "<valid-product-uuid>",
  quantity: 1,
  delivery_selected: true,
  vendor_lat: 37.7749,
  vendor_lng: -122.4194,
  customer_lat: 37.7849,
  customer_lng: -122.4094,
});

console.log("\n4) Infinity in coords should 400:");
exampleCurl("Infinity customer_lat", {
  product_id: "<valid-product-uuid>",
  quantity: 1,
  delivery_selected: true,
  vendor_lat: 37.77,
  vendor_lng: -122.41,
  customer_lat: Infinity,
  customer_lng: -122.41,
});

console.log("\nDone. Replace <valid-product-uuid> and Cookie with real values when testing.");
