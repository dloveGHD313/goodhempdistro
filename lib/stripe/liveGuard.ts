/**
 * Stripe LIVE MODE enforcement.
 * Platform runs 100% live: no test keys, no sandbox, no NODE_ENV branching for Stripe.
 * Fails fast when Stripe is used with test keys or invalid webhook secret.
 */

const STRIPE_SECRET_KEY = "STRIPE_SECRET_KEY";
const STRIPE_WEBHOOK_SECRET = "STRIPE_WEBHOOK_SECRET";

/**
 * Assert STRIPE_SECRET_KEY is set and is a LIVE key (sk_live_).
 * Call before creating any Stripe client or making Stripe API calls.
 * Throws if key is missing, empty, or is a test key (sk_test_).
 */
export function assertStripeLiveSecret(): void {
  const key = process.env[STRIPE_SECRET_KEY];
  if (!key || typeof key !== "string" || key.trim() === "") {
    throw new Error(
      "STRIPE_SECRET_KEY is required. Set it in Vercel → Environment Variables. Use a live secret key (sk_live_...)."
    );
  }
  if (!key.startsWith("sk_live_")) {
    console.error("[stripe] STRIPE_SECRET_KEY must be a live key (sk_live_...). Test keys (sk_test_) are not allowed.");
    throw new Error(
      "STRIPE_SECRET_KEY must be a live key (sk_live_...). Test keys are not allowed in production."
    );
  }
}

/**
 * Assert STRIPE_WEBHOOK_SECRET is set and has valid format (whsec_).
 * Call before verifying webhook signatures.
 * Throws if secret is missing, empty, or does not start with whsec_.
 */
export function assertStripeWebhookSecret(): void {
  const secret = process.env[STRIPE_WEBHOOK_SECRET];
  if (!secret || typeof secret !== "string" || secret.trim() === "") {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is required. Set it in Vercel → Environment Variables (from Stripe Dashboard → Webhooks)."
    );
  }
  if (!secret.startsWith("whsec_")) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET must start with whsec_.");
    throw new Error(
      "STRIPE_WEBHOOK_SECRET must be a valid webhook signing secret (whsec_...)."
    );
  }
}
