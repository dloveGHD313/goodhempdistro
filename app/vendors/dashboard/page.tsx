import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getProductLimitStatus, getVendorEntitlements, getVendorPlanByPriceId } from "@/lib/pricing";
import { isAdminEmail } from "@/lib/admin";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StatusCounts = {
  draft: number;
  pending_review: number;
  approved: number;
  rejected: number;
};

type EventCounts = {
  draft: number;
  pending_review: number;
  approved: number;
  rejected: number;
  published: number;
  cancelled: number;
};

async function getVendorData(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: vendor } = await supabase
      .from("vendors")
      .select(
        "id, owner_user_id, business_name, status, vendor_type, created_at, is_active, is_approved, vendor_onboarding_completed, terms_accepted_at, compliance_acknowledged_at, subscription_status, subscription_plan_key, subscription_price_id, stripe_customer_id, stripe_subscription_id, subscription_current_period_end, subscription_cancel_at_period_end"
      )
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (!vendor) {
      return null;
    }

    if (vendor.owner_user_id !== userId) {
      console.error("[vendors/dashboard] SECURITY: Vendor owner_user_id mismatch!", {
        userId,
        vendor_owner_user_id: vendor.owner_user_id,
      });
      return null;
    }

    const { data: productStatuses } = await supabase
      .from("products")
      .select("status")
      .eq("owner_user_id", userId);

    const { data: serviceStatuses } = await supabase
      .from("services")
      .select("status")
      .eq("owner_user_id", userId);

    const { data: eventStatuses } = await supabase
      .from("events")
      .select("status")
      .eq("vendor_id", vendor.id);

    const tally = (rows: Array<{ status: string }> | null): StatusCounts => {
      const counts: StatusCounts = {
        draft: 0,
        pending_review: 0,
        approved: 0,
        rejected: 0,
      };
      (rows || []).forEach((row) => {
        if (row.status === "draft") counts.draft += 1;
        if (row.status === "pending_review") counts.pending_review += 1;
        if (row.status === "approved") counts.approved += 1;
        if (row.status === "rejected") counts.rejected += 1;
      });
      return counts;
    };

    const tallyEvents = (rows: Array<{ status: string }> | null): EventCounts => {
      const counts: EventCounts = {
        draft: 0,
        pending_review: 0,
        approved: 0,
        rejected: 0,
        published: 0,
        cancelled: 0,
      };
      (rows || []).forEach((row) => {
        if (row.status === "draft") counts.draft += 1;
        if (row.status === "pending_review") counts.pending_review += 1;
        if (row.status === "approved") counts.approved += 1;
        if (row.status === "rejected") counts.rejected += 1;
        if (row.status === "published") counts.published += 1;
        if (row.status === "cancelled") counts.cancelled += 1;
      });
      return counts;
    };

    const productTotal = (productStatuses || []).length;

    return {
      vendor,
      productCounts: tally(productStatuses),
      serviceCounts: tally(serviceStatuses),
      eventCounts: tallyEvents(eventStatuses),
      productTotal,
    };
  } catch (error) {
    console.error("[vendors/dashboard] Error fetching vendor data:", error);
    return null;
  }
}

export default async function VendorDashboardPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user) {
    console.error("[vendors/dashboard] SSR user is null - no authenticated session!", {
      userError: userError?.message || null,
    });
    redirect("/login?redirect=/vendors/dashboard");
  }

  const isAdmin = isAdminEmail(user.email);
  const vendorData = await getVendorData(user.id);

  if (!vendorData && !isAdmin) {
    redirect("/vendor-registration");
  }

  if (!vendorData && isAdmin) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2 text-accent">Admin Vendor Access</h1>
              <p className="text-muted">You can access vendor tools without a subscription.</p>
            </div>
            <div className="surface-card p-6">
              <p className="text-muted text-sm mb-4">
                No vendor profile is linked to this admin account. Use vendor tools directly or visit pricing to start a vendor checkout.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/vendors/products" className="btn-primary">
                  Manage products
                </Link>
                <Link href="/vendors/services" className="btn-secondary">
                  Manage services
                </Link>
                <Link href="/vendors/events" className="btn-secondary">
                  Manage events
                </Link>
                <Link href="/pricing?tab=vendor" className="btn-secondary">
                  View pricing
                </Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  if (!vendorData) {
    redirect("/vendor-registration");
  }

  const { vendor, productCounts, serviceCounts, eventCounts, productTotal } = vendorData;

  const planKey =
    vendor.subscription_plan_key ||
    (vendor.subscription_price_id
      ? getVendorPlanByPriceId(vendor.subscription_price_id)?.planKey || null
      : null);
  const entitlements = planKey ? getVendorEntitlements(planKey) : null;
  const productLimitStatus = getProductLimitStatus(productTotal, entitlements?.productLimit ?? null);

  const onboardingComplete =
    vendor.vendor_onboarding_completed &&
    vendor.terms_accepted_at &&
    vendor.compliance_acknowledged_at;
  const approved = vendor.is_approved || vendor.status === "active";
  const active = vendor.is_active && approved;
  const submittedDate = vendor.created_at
    ? new Date(vendor.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  if (!onboardingComplete) {
    redirect("/onboarding/vendor");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 text-accent">{vendor.business_name}</h1>
            <p className="text-muted">Vendor Dashboard</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="surface-card p-6">
              <div className="text-sm text-muted">Onboarding</div>
              <div className="text-xl font-semibold mt-1">
                {onboardingComplete ? "Complete" : "Incomplete"}
              </div>
              {!onboardingComplete && (
                <Link href="/onboarding/vendor" className="btn-primary mt-4 inline-block">
                  Complete onboarding
                </Link>
              )}
            </div>
            <div className="surface-card p-6">
              <div className="text-sm text-muted">Approval status</div>
              <div className="text-xl font-semibold mt-1">
                {approved ? "Approved" : "Pending review"}
              </div>
              {!approved && (
                <p className="text-muted text-sm mt-2">
                  Submitted on {submittedDate}. We will notify you once approved.
                </p>
              )}
            </div>
            <div className="surface-card p-6">
              <div className="text-sm text-muted">Account status</div>
              <div className="text-xl font-semibold mt-1">
                {active ? "Active" : "Inactive"}
              </div>
              {!active && (
                <p className="text-muted text-sm mt-2">
                  Activation happens after onboarding and approval.
                </p>
              )}
            </div>
          </div>

          <div className="surface-card p-6 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-semibold">Vendor profile</h2>
              <Link href="/vendors/dashboard/profile" className="text-accent text-sm">
                View profile
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted">
              <div>
                <div className="text-xs uppercase tracking-wide">Vendor type</div>
                <div className="text-base text-white">
                  {vendor.vendor_type ? vendor.vendor_type.replace(/_/g, " ") : "Not set"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide">Member since</div>
                <div className="text-base text-white">{submittedDate}</div>
              </div>
            </div>
          </div>

          <div className="surface-card p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Subscription</h2>
              <Link href="/vendors/billing" className="text-accent text-sm">
                Manage billing
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted">
              <div>
                <div className="text-xs uppercase tracking-wide">Status</div>
                <div className="text-base text-white">
                  {vendor.subscription_status || "inactive"}
                </div>
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
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
              <div>
                Product limit:{" "}
                <span className="text-white">
                  {entitlements?.productLimit === null ? "Unlimited" : entitlements?.productLimit ?? "Unknown"}
                </span>
              </div>
              <div>
                Products used: <span className="text-white">{productTotal}</span>
              </div>
            </div>
            {productLimitStatus.reached && (
              <div className="mt-4 rounded-lg border border-yellow-600 bg-yellow-900/30 p-4 text-yellow-200 text-sm">
                Product limit reached. Upgrade your plan to add more products.
                <Link href="/pricing?tab=vendor" className="underline text-accent ml-2">
                  Upgrade plan
                </Link>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Products</h2>
                <Link href="/vendors/dashboard/products" className="text-accent text-sm">
                  Manage
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-muted">
                <div>Drafts: <span className="text-white">{productCounts.draft}</span></div>
                <div>Pending: <span className="text-white">{productCounts.pending_review}</span></div>
                <div>Approved: <span className="text-white">{productCounts.approved}</span></div>
                <div>Rejected: <span className="text-white">{productCounts.rejected}</span></div>
              </div>
              <div className="mt-4">
                <Link href="/vendors/products/new" className="btn-primary">
                  Create new product
                </Link>
              </div>
            </div>
            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Services</h2>
                <Link href="/vendors/dashboard/services" className="text-accent text-sm">
                  Manage
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-muted">
                <div>Drafts: <span className="text-white">{serviceCounts.draft}</span></div>
                <div>Pending: <span className="text-white">{serviceCounts.pending_review}</span></div>
                <div>Approved: <span className="text-white">{serviceCounts.approved}</span></div>
                <div>Rejected: <span className="text-white">{serviceCounts.rejected}</span></div>
              </div>
              <div className="mt-4">
                <Link href="/vendors/services/new" className="btn-primary">
                  Create new service
                </Link>
              </div>
            </div>
            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Events</h2>
                <Link href="/vendors/dashboard/events" className="text-accent text-sm">
                  Manage
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-muted">
                <div>Drafts: <span className="text-white">{eventCounts.draft}</span></div>
                <div>Pending: <span className="text-white">{eventCounts.pending_review}</span></div>
                <div>Approved: <span className="text-white">{eventCounts.approved}</span></div>
                <div>Published: <span className="text-white">{eventCounts.published}</span></div>
                <div>Rejected: <span className="text-white">{eventCounts.rejected}</span></div>
                <div>Cancelled: <span className="text-white">{eventCounts.cancelled}</span></div>
              </div>
              <div className="mt-4">
                <Link href="/vendors/events/new" className="btn-primary">
                  Create new event
                </Link>
              </div>
            </div>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-2xl font-semibold mb-3">Next actions</h2>
            <ul className="text-muted space-y-2">
              {!onboardingComplete && <li>Finish vendor onboarding.</li>}
              {onboardingComplete && !approved && <li>Awaiting approval from our team.</li>}
              {onboardingComplete && approved && !active && (
                <li>Contact support to activate your vendor profile.</li>
              )}
              {onboardingComplete && approved && active && (
                <li>Visit vendor tools to start listing.</li>
              )}
            </ul>
            {onboardingComplete && approved && active && (
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/vendors/products" className="btn-primary">
                  Manage products
                </Link>
                <Link href="/vendors/services" className="btn-secondary">
                  Manage services
                </Link>
                <Link href="/vendors/events" className="btn-secondary">
                  Manage events
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
