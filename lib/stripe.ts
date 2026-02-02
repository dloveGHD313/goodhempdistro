import Stripe from "stripe";
import { assertStripeLiveSecret } from "./stripe/liveGuard";
import {
  STRIPE_PRICES,
  type PlanKey,
  type BillingInterval,
} from "./stripe/prices";

const allowedPriceIds = new Set<string>(
  Object.values(STRIPE_PRICES).flatMap((p) => [p.MONTHLY, p.ANNUAL])
);

export function resolvePriceId(input: {
  priceId?: string;
  planKey?: string;
  billingInterval?: string;
}): string {
  if (input.priceId) {
    if (!allowedPriceIds.has(input.priceId)) {
      console.warn("[stripe] Invalid priceId attempted", {
        priceIdPrefix: input.priceId?.slice(0, 12),
      });
      throw new Error("Invalid priceId");
    }
    return input.priceId;
  }
  if (input.planKey && input.billingInterval) {
    const planKey = input.planKey as PlanKey;
    const interval = input.billingInterval.toUpperCase() as BillingInterval;
    const plan = STRIPE_PRICES[planKey];
    if (!plan) {
      console.warn("[stripe] Invalid planKey attempted", { planKey });
      throw new Error("Invalid planKey");
    }
    const priceId = plan[interval];
    if (!priceId) {
      console.warn("[stripe] Invalid billingInterval attempted", {
        planKey,
        billingInterval: interval,
      });
      throw new Error("Invalid billingInterval");
    }
    return priceId;
  }
  throw new Error("Missing price selection");
}

// Lazy initialization - only create Stripe client when actually used
// This allows the build to complete even if env vars are missing
let stripeInstance: Stripe | null = null;

function getStripeClient(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  // LIVE MODE ONLY: fail if test key or missing
  assertStripeLiveSecret();

  stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });

  return stripeInstance;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripeClient();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Get the site URL for redirects
 * Uses NEXT_PUBLIC_SITE_URL in production, falls back to localhost in dev
 */
export function getSiteUrl(request?: { headers: Headers }): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  const origin = request?.headers.get("origin")?.trim();
  if (origin) {
    return origin.replace(/\/$/, "");
  }

  const host =
    request?.headers.get("x-forwarded-host")?.trim() ||
    request?.headers.get("host")?.trim();
  if (host) {
    const proto = request?.headers.get("x-forwarded-proto")?.trim() || "https";
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  return process.env.NODE_ENV === "production"
    ? "https://goodhempdistro.vercel.app"
    : "http://localhost:3000";
}

/**
 * Create a checkout session for a product purchase
 */
export async function createCheckoutSession(params: {
  productId: string;
  priceInCents: number;
  userId?: string;
  orderId?: string;
  successPath?: string;
  cancelPath?: string;
  affiliateCode?: string;
}) {
  const {
    productId,
    priceInCents,
    userId,
    orderId,
    successPath = "/orders/success",
    cancelPath = "/products",
    affiliateCode = "",
  } = params;

  const siteUrl = getSiteUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Product ${productId}`,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}${cancelPath}`,
    metadata: {
      product_id: productId,
      user_id: userId || "guest",
      order_id: orderId || "",
      affiliate_code: affiliateCode,
    },
  });

  return session;
}

/**
 * Create a subscription checkout session
 * priceId must be in STRIPE_PRICES allowlist (validated server-side).
 */
export async function createSubscriptionSession(params: {
  priceId: string;
  userId: string;
  successPath?: string;
  cancelPath?: string;
  affiliateCode?: string;
}) {
  const {
    priceId: rawPriceId,
    userId,
    successPath = "/dashboard",
    cancelPath = "/pricing",
    affiliateCode = "",
  } = params;

  const priceId = resolvePriceId({ priceId: rawPriceId });
  const siteUrl = getSiteUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}${cancelPath}`,
    metadata: {
      user_id: userId,
      affiliate_code: affiliateCode,
    },
  });

  return session;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  return subscription;
}

/**
 * Retrieve checkout session details
 */
export async function getCheckoutSession(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items", "payment_intent"],
  });

  return session;
}
