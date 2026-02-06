/**
 * Canonical Stripe server client — LIVE mode only.
 * All API routes must use getStripeServer(); never instantiate Stripe directly.
 */

import Stripe from "stripe";
import { assertStripeLiveSecret } from "./liveGuard";

let stripeServerInstance: Stripe | null = null;

/**
 * Returns the single Stripe server client. Reads STRIPE_SECRET_KEY.
 * Throws a clear error if missing or if key is not live (sk_live_).
 */
export function getStripeServer(): Stripe {
  if (stripeServerInstance) {
    return stripeServerInstance;
  }
  assertStripeLiveSecret();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.trim()) {
    throw new Error("STRIPE_SECRET_KEY is required. Set it in Vercel → Environment Variables.");
  }
  // Keep in sync with Stripe Dashboard API version. Must be a published stable version (not future-dated / not speculative).
  stripeServerInstance = new Stripe(key, {
    apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion,
    typescript: true,
  });
  return stripeServerInstance;
}
