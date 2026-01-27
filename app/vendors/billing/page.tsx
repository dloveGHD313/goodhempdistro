import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getVendorEntitlements, getVendorPlanByPriceId } from "@/lib/pricing";
import { isAdminEmail } from "@/lib/admin";
import Footer from "@/components/Footer";
import BillingPortalButton from "./BillingPortalButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VendorsBillingPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/billing");
  }

  const admin = getSupabaseAdminClient();
  const { data: vendor } = await admin
    .from("vendors")
    .select(
      "id, owner_user_id, business_name, subscription_status, subscription_plan_key, subscription_price_id, subscription_current_period_end, subscription_cancel_at_period_end, stripe_customer_id"
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const isAdmin = isAdminEmail(user.email);
  if (!vendor && !isAdmin) {
    redirect("/vendor-registration");
  }

  const planKey =
    vendor?.subscription_plan_key ||
    (vendor?.subscription_price_id
      ? getVendorPlanByPriceId(vendor.subscription_price_id)?.planKey || null
      : null);
  const entitlements = planKey ? getVendorEntitlements(planKey) : null;

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 text-accent">Billing</h1>
            <p className="text-muted">Manage your vendor subscription and payments.</p>
          </div>

          {!vendor && (
            <div className="surface-card p-6">
              <p className="text-muted text-sm">
                No vendor profile is linked to this account yet.
              </p>
              <div className="mt-4 flex gap-3">
                <Link href="/pricing?tab=vendor" className="btn-primary">
                  View vendor plans
                </Link>
                <Link href="/vendors/dashboard" className="btn-secondary">
                  Vendor dashboard
                </Link>
              </div>
            </div>
          )}

          {vendor && (
            <div className="surface-card p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted">
                <div>
                  <div className="text-xs uppercase tracking-wide">Status</div>
                  <div className="text-base text-white">{vendor.subscription_status || "inactive"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide">Plan</div>
                  <div className="text-base text-white">{entitlements?.tier || "Unknown"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide">Renewal</div>
                  <div className="text-base text-white">
                    {vendor.subscription_current_period_end
                      ? new Date(vendor.subscription_current_period_end).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "N/A"}
                  </div>
                </div>
              </div>
              {vendor.subscription_cancel_at_period_end && (
                <p className="text-sm text-yellow-200 mt-4">
                  Your subscription is set to cancel at the end of the current period.
                </p>
              )}
              {!vendor.stripe_customer_id && (
                <p className="text-sm text-yellow-200 mt-4">
                  Billing portal is unavailable because no Stripe customer ID is linked yet.
                </p>
              )}
              <div className="mt-6">
                {vendor.stripe_customer_id ? (
                  <BillingPortalButton />
                ) : (
                  <Link href="/pricing?tab=vendor" className="btn-primary">
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
