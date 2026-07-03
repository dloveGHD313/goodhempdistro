/**
 * Stripe LIVE config assertion for production.
 * Call at top of Stripe/Connect/checkout routes.
 * Safe messages only — no secret echoing.
 *
 * Environment gating uses isStripeProductionEnv() from liveGuard: on Vercel,
 * VERCEL_ENV is authoritative. The previous local isProduction() included
 * `NODE_ENV === "production"` — but Vercel PREVIEW builds run with
 * NODE_ENV=production, so preview deploys were incorrectly enforced as live
 * and could never use sk_test_ keys for the test-mode smoke checklist.
 */

import { isStripeProductionEnv } from "@/lib/stripe/liveGuard";

const STRIPE_SECRET_KEY = "STRIPE_SECRET_KEY";
const NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY";
const STRIPE_WEBHOOK_SECRET = "STRIPE_WEBHOOK_SECRET";

function isProduction(): boolean {
  return isStripeProductionEnv();
}

/**
 * In production, requires:
 * - STRIPE_SECRET_KEY starts with sk_live_
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY starts with pk_live_
 * - STRIPE_WEBHOOK_SECRET set (starts with whsec_)
 * Throws with a SAFE message (no secret values).
 */
export function assertStripeLiveConfig(): void {
  if (!isProduction()) {
    return;
  }
  const missing: string[] = [];
  const invalid: string[] = [];

  const secretKey = process.env[STRIPE_SECRET_KEY]?.trim();
  if (!secretKey) {
    missing.push(STRIPE_SECRET_KEY);
  } else if (!secretKey.startsWith("sk_live_")) {
    invalid.push(`${STRIPE_SECRET_KEY} must be a live key (sk_live_...)`);
  }

  const publishableKey = process.env[NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY]?.trim();
  if (!publishableKey) {
    missing.push(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  } else if (!publishableKey.startsWith("pk_live_")) {
    invalid.push(`${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} must be a live key (pk_live_...)`);
  }

  const webhookSecret = process.env[STRIPE_WEBHOOK_SECRET]?.trim();
  if (!webhookSecret) {
    missing.push(STRIPE_WEBHOOK_SECRET);
  } else if (!webhookSecret.startsWith("whsec_")) {
    invalid.push(`${STRIPE_WEBHOOK_SECRET} must start with whsec_`);
  }

  // STRIPE_CONNECT_CLIENT_ID is optional for Express account links; required only for OAuth Connect.

  if (missing.length > 0) {
    throw new Error(
      `Stripe production config missing: ${missing.join(", ")}. Set in Vercel → Environment Variables. Do not commit real values.`
    );
  }
  if (invalid.length > 0) {
    throw new Error(`Stripe production config invalid: ${invalid.join("; ")}`);
  }
}
