/**
 * Stripe LIVE MODE enforcement — production-gated.
 *
 * PRODUCTION runs 100% live: test keys throw, test-mode webhook events are
 * rejected. PREVIEW and DEVELOPMENT may use sk_test_ keys — required by the
 * test-mode smoke checklist (.claude/audit/STRIPE-CONNECT-TEST-MODE-SMOKE.md),
 * which runs the full Connect funds-flow against a Vercel preview deploy
 * with Stripe test keys before anything touches live money.
 *
 * Environment detection: on Vercel, VERCEL_ENV ("production" | "preview" |
 * "development") is authoritative — NODE_ENV is "production" for BOTH
 * production and preview builds, so it cannot distinguish them. NODE_ENV is
 * only consulted when VERCEL_ENV is absent (non-Vercel/local runs).
 */

const STRIPE_SECRET_KEY = "STRIPE_SECRET_KEY";
const STRIPE_WEBHOOK_SECRET = "STRIPE_WEBHOOK_SECRET";

/**
 * True only for the real production environment. Preview deploys return
 * false even though their build runs with NODE_ENV=production.
 */
export function isStripeProductionEnv(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv === "production";
  return process.env.NODE_ENV === "production";
}

/**
 * Assert STRIPE_SECRET_KEY is set; in PRODUCTION it must be a live key
 * (sk_live_). Preview/development may use sk_test_ keys (a warning is
 * logged so it's visible which mode a deploy is running in).
 * Throws if the key is missing/empty in any environment, or is a test key
 * in production.
 */
export function assertStripeLiveSecret(): void {
  const key = process.env[STRIPE_SECRET_KEY];
  if (!key || typeof key !== "string" || key.trim() === "") {
    throw new Error(
      "STRIPE_SECRET_KEY is required. Set it in Vercel → Environment Variables."
    );
  }
  if (isStripeProductionEnv()) {
    if (!key.startsWith("sk_live_")) {
      console.error("[stripe] STRIPE_SECRET_KEY must be a live key (sk_live_...) in production. Test keys (sk_test_) are not allowed.");
      throw new Error(
        "STRIPE_SECRET_KEY must be a live key (sk_live_...). Test keys are not allowed in production."
      );
    }
  } else if (key.startsWith("sk_test_")) {
    // Expected on preview/dev during test-mode smoke runs — surface it so
    // nobody mistakes a test-mode deploy for live.
    console.warn("[stripe] Running with TEST-MODE Stripe key (sk_test_) — non-production environment.");
  }
}

/**
 * Assert STRIPE_WEBHOOK_SECRET is set and has valid format (whsec_).
 * Format requirement applies in every environment — test-mode webhook
 * endpoints have their own whsec_ secrets.
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
