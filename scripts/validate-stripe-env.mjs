#!/usr/bin/env node
/**
 * Validates vendor Stripe PRICE_ID env vars only (key names; values must start with price_).
 * Exit non-zero if any required key is missing or value does not start with price_.
 * Safe for CI; only logs key NAMES. Usage: node scripts/validate-stripe-env.mjs
 */
import fs from "fs";
import path from "path";

const VENDOR_PRICE_ENV_KEYS = [
  "STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID",
  "STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID",
  "STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID",
  "STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID",
  "STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID",
  "STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID",
];

function loadEnv() {
  const env = { ...process.env };
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
      }
    }
  } catch (_) {}
  return env;
}

const env = loadEnv();
const missing = [];
const invalid = [];

for (const key of VENDOR_PRICE_ENV_KEYS) {
  const raw = env[key];
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    missing.push(key);
    continue;
  }
  const val = raw.trim();
  if (!val.startsWith("price_") || val.startsWith("prod_")) {
    invalid.push(key);
  }
}

if (missing.length > 0) {
  console.error("Missing vendor PRICE_ID env (set in Vercel / .env.local):", missing.join(", "));
}
if (invalid.length > 0) {
  console.error("Invalid vendor PRICE_ID env (must start with price_, not prod_):", invalid.join(", "));
}

if (missing.length > 0 || invalid.length > 0) {
  process.exit(1);
}
console.log("Vendor PRICE_ID env check OK:", VENDOR_PRICE_ENV_KEYS.length, "keys");
