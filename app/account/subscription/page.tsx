import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getConsumerEntitlements, getConsumerPlanByKey } from "@/lib/consumer-plans";
import { isAdminEmail } from "@/lib/admin";
import Footer from "@/components/Footer";
import BillingPortalButton from "./BillingPortalButton";
import ReferralCodeCard from "./ReferralCodeCard";
import ConsumerPerkMatrix from "@/components/perks/ConsumerPerkMatrix";
import { TIER_ENTITLEMENTS, planKeyToTier } from "@/lib/entitlements";
import { isConsumerSubscriptionActive } from "@/lib/consumer-access";
import { getBrandLoyaltyStatuses } from "@/lib/brandLoyalty";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountSubscriptionPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account/subscription");
  }

  const admin = getSupabaseAdminClient();
  const { data: subscription } = await admin
    .from("consumer_subscriptions")
    .select(
      "user_id, consumer_plan_key, subscription_status, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdmin = isAdminEmail(user.email);
  if (!subscription && !isAdmin) {
    redirect("/pricing?tab=consumer");
  }

  const planKey = subscription?.consumer_plan_key || null;
  const entitlements = planKey ? getConsumerEntitlements(planKey) : null;
  const planConfig = planKey ? getConsumerPlanByKey(planKey) : null;
  // Perks spec 2026-07-10: referral links are open to all tiers.
  const canShowReferralCard = true;

  // Perks (spec §8): current tier + live perk state.
  const tier = isConsumerSubscriptionActive(subscription?.subscription_status)
    ? planKeyToTier(planKey)
    : "Free";
  const perks = TIER_ENTITLEMENTS[tier];

  const { data: activeCoupons } = await admin
    .from("consumer_coupons")
    .select("code, percent_off, source, status, expires_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("expires_at", { ascending: true });

  const brandStatuses = (await getBrandLoyaltyStatuses(user.id)).filter(
    (b) => b.status !== "None"
  );
  let brandVendorNames = new Map<string, string>();
  if (brandStatuses.length > 0) {
    const { data: brandVendors } = await admin
      .from("vendors")
      .select("id, business_name")
      .in("id", brandStatuses.map((b) => b.vendor_id));
    brandVendorNames = new Map(
      (brandVendors || []).map((v) => [v.id, v.business_name])
    );
  }

  const { data: loyalty } = await admin
    .from("consumer_loyalty")
    .select("points_balance, lifetime_points_earned, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: referrals } = await admin
    .from("consumer_referrals")
    .select("referral_code, reward_points, reward_status")
    .eq("referrer_user_id", user.id);

  const referralCode = referrals?.find((row) => !!row.referral_code)?.referral_code || null;
  const referralEarnings = (referrals || [])
    .filter((row) => row.reward_status === "granted")
    .reduce((sum, row) => sum + (row.reward_points || 0), 0);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 text-accent">My Subscription</h1>
            <p className="text-muted">Manage your consumer subscription.</p>
          </div>

          {!subscription && (
            <div className="surface-card p-6">
              <p className="text-muted text-sm">
                No consumer subscription is linked to this account yet.
              </p>
              <div className="mt-4 flex gap-3">
                <Link href="/pricing?tab=consumer" className="btn-primary">
                  View consumer plans
                </Link>
                <Link href="/account" className="btn-secondary">
                  Account
                </Link>
              </div>
            </div>
          )}

          {subscription && (
            <div className="surface-card p-6">
              {planConfig && (
                <div className="mb-6 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
                  <div className="overflow-hidden rounded-2xl border border-white/10">
                    <img
                      src={planConfig.imageUrl}
                      alt={`${planConfig.displayName} plan`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      {planConfig.displayName}
                    </h2>
                    <p className="text-muted mb-4">{planConfig.priceText}</p>
                    <ul className="text-sm text-muted space-y-2">
                      {(planConfig.bullets || []).map((bullet, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-accent">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted">
                <div>
                  <div className="text-xs uppercase tracking-wide">Status</div>
                  <div className="text-base text-white">
                    {subscription.subscription_status || "inactive"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide">Plan</div>
                  <div className="text-base text-white">{entitlements?.tier || "Unknown"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide">Renewal</div>
                  <div className="text-base text-white">
                    {subscription.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "N/A"}
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="surface-card p-4">
                  <div className="text-xs uppercase tracking-wide text-muted">Loyalty balance</div>
                  <div className="text-2xl font-semibold text-white">
                    {loyalty?.points_balance ?? 0} pts
                  </div>
                  <div className="text-xs text-muted mt-1">
                    Lifetime earned: {loyalty?.lifetime_points_earned ?? 0} pts
                  </div>
                </div>
                <div className="surface-card p-4">
                  <div className="text-xs uppercase tracking-wide text-muted">Referral earnings</div>
                  <div className="text-2xl font-semibold text-white">
                    {referralEarnings} pts
                  </div>
                  <div className="text-xs text-muted mt-1">
                    Rewards are granted after a referred user subscribes.
                  </div>
                </div>
                {canShowReferralCard && (
                  <ReferralCodeCard initialCode={referralCode} />
                )}
              </div>
              {subscription.cancel_at_period_end && (
                <p className="text-sm text-yellow-200 mt-4">
                  Your subscription is set to cancel at the end of the current period.
                </p>
              )}
              {!subscription.stripe_customer_id && (
                <p className="text-sm text-yellow-200 mt-4">
                  Billing portal is unavailable because no Stripe customer ID is linked yet.
                </p>
              )}
              <div className="mt-6">
                {subscription.stripe_customer_id ? (
                  <BillingPortalButton />
                ) : (
                  <Link href="/pricing?tab=consumer" className="btn-primary">
                    Choose a plan
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Member perks (perks spec 2026-07-10 §8) */}
          <div className="surface-card p-6 mt-8">
            <h2 className="text-2xl font-semibold mb-4">
              Your member perks — {tier}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="surface-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted">Points multiplier</div>
                <div className="text-2xl font-semibold text-white">
                  {perks.pointsMultiplier}× on every purchase
                </div>
              </div>
              <div className="surface-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted">
                  Learning with JAX
                </div>
                <div className="text-base text-white">
                  {perks.jaxEarlyAccessHours > 0
                    ? `${perks.jaxEarlyAccessHours / 24}-day early access${perks.jaxMembersOnly ? " + members-only episodes" : ""}`
                    : "Episodes on public release"}
                </div>
              </div>
              <div className="surface-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted">Event tickets</div>
                <div className="text-base text-white">
                  {perks.eventTicketDiscountPct > 0
                    ? `${perks.eventTicketDiscountPct}% off${perks.eventEarlyAccessHours > 0 ? ` · ${perks.eventEarlyAccessHours}h early` : ""}${perks.freeEventTicketsPerQuarter > 0 ? " · 1 free community ticket/quarter" : ""}`
                    : "Full price"}
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-2">Your coupons</h3>
            {activeCoupons && activeCoupons.length > 0 ? (
              <ul className="text-sm space-y-2 mb-6">
                {activeCoupons.map((coupon) => (
                  <li key={coupon.code} className="flex items-center gap-3">
                    <code className="bg-[var(--bg)] border border-white/10 px-2 py-1 rounded">
                      {coupon.code}
                    </code>
                    <span className="text-white">{Number(coupon.percent_off)}% off</span>
                    <span className="text-muted">
                      {coupon.source === "vendor" ? "vendor coupon" : "platform coupon"}
                      {coupon.expires_at
                        ? ` · expires ${new Date(coupon.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted mb-6">
                {perks.monthlyCoupons
                  ? `Your ${perks.monthlyCoupons.count} × ${perks.monthlyCoupons.percentOff}% member coupon${perks.monthlyCoupons.count > 1 ? "s" : ""} arrive at the start of each month.`
                  : "Members receive monthly platform coupons — upgrade to unlock."}
              </p>
            )}

            {brandStatuses.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-2">Brand loyalty</h3>
                <ul className="text-sm space-y-2 mb-6">
                  {brandStatuses.map((b) => (
                    <li key={b.vendor_id} className="flex items-center gap-3">
                      <span>
                        {b.status === "Gold" ? "🥇" : b.status === "Silver" ? "🥈" : "🥉"}
                      </span>
                      <span className="text-white">
                        {brandVendorNames.get(b.vendor_id) || "Vendor"}
                      </span>
                      <span className="text-muted">
                        {b.status} · {b.completed_orders} orders
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <details>
              <summary className="cursor-pointer text-accent text-sm font-semibold">
                Compare all membership tiers
              </summary>
              <div className="mt-4">
                <ConsumerPerkMatrix highlightTier={tier} />
              </div>
            </details>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
