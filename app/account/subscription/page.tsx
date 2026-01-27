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
                <ReferralCodeCard initialCode={referralCode} />
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
        </section>
      </main>
      <Footer />
    </div>
  );
}
