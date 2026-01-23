import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getVendorData(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: vendor } = await supabase
      .from("vendors")
      .select(
        "id, owner_user_id, business_name, status, vendor_type, created_at, is_active, is_approved, vendor_onboarding_completed, terms_accepted_at, compliance_acknowledged_at"
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

    return vendor;
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

  const vendor = await getVendorData(user.id);

  if (!vendor) {
    redirect("/vendor-registration");
  }

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
            <h2 className="text-2xl font-semibold mb-3">Vendor profile</h2>
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
