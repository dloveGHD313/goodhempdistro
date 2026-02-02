#!/usr/bin/env node
/**
 * Validates that required env var NAMES are present (values not checked).
 * Prints missing key names only. Safe to run in CI; no secrets echoed.
 * Usage: node scripts/verify-env.mjs  or  npm run verify:env
 */
import fs from "fs";
import path from "path";

const required = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_CONNECT_CLIENT_ID",
];

const optional = [
  "SUPABASE_URL",
  "ADMIN_EMAILS",
  "ADMIN_EMAIL_DOMAIN",
  "DEBUG_KEY",
  "INTOXICATING_ALLOWED_UNTIL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_SEARCH_MODEL",
  "MASCOT_AI_ENABLED",
  "NEXT_PUBLIC_MASCOT_ENABLED",
];

function loadEnv() {
  const env = { ...process.env };
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (m) env[m[1]] = m[2].trim();
      }
    }
  } catch (_) {}
  return env;
}

function main() {
  const env = loadEnv();
  const missing = required.filter((key) => !env[key] || String(env[key]).trim() === "");
  if (missing.length > 0) {
    console.error("Missing required env vars (names only):");
    missing.forEach((k) => console.error("  -", k));
    process.exit(1);
  }
  console.log("Required env vars present:", required.length);
}

main();
