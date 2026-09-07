import type Stripe from "stripe";

type SubscriptionRetriever = {
  subscriptions: { retrieve: (id: string) => Promise<Stripe.Subscription> };
};

/**
 * Stripe delivers (and retries) webhook events out of order. On 2026-09-07 a replayed
 * `customer.subscription.created` (status=incomplete) arrived after `…deleted` and overwrote a
 * canceled row with "incomplete". Treat Stripe's current object as the source of truth: refetch
 * the subscription and use that state; fall back to the event payload only if the fetch fails.
 * `deleted` events are final and already carry the terminal state, so they are used as-is.
 */
export async function freshestSubscription(
  eventType: string,
  eventSubscription: Stripe.Subscription,
  stripe: SubscriptionRetriever
): Promise<{ subscription: Stripe.Subscription; source: "stripe" | "event" }> {
  if (eventType === "customer.subscription.deleted") {
    return { subscription: eventSubscription, source: "event" };
  }
  try {
    const live = await stripe.subscriptions.retrieve(eventSubscription.id);
    if (live && live.id === eventSubscription.id) {
      return { subscription: live, source: "stripe" };
    }
  } catch (err) {
    console.warn(
      `[webhook] subscription refetch failed, using event payload | subscription=${eventSubscription.id} | ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
  return { subscription: eventSubscription, source: "event" };
}
