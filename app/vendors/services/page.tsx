import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import ServicesClient from "./ServicesClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getVendorServices(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Get vendor
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, owner_user_id, vendor_onboarding_completed, terms_accepted_at, compliance_acknowledged_at")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (!vendor) {
      return null;
    }
    if (
      !vendor.vendor_onboarding_completed ||
      !vendor.terms_accepted_at ||
      !vendor.compliance_acknowledged_at
    ) {
      redirect("/onboarding/vendor");
    }

    // Get all services for this vendor (all statuses)
    const { data: services, error } = await supabase
      .from("services")
      .select("id, name, title, description, pricing_type, price_cents, status, active, category_id, submitted_at, reviewed_at, rejection_reason, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[vendors/services] Error fetching services:", error);
      return { services: [], error: error.message };
    }

    // Group by status
    const drafts = (services || []).filter(s => s.status === 'draft');
    const pending = (services || []).filter(s => s.status === 'pending_review');
    const approved = (services || []).filter(s => s.status === 'approved');
    const rejected = (services || []).filter(s => s.status === 'rejected');

    return {
      services: services || [],
      counts: {
        draft: drafts.length,
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        total: (services || []).length,
      },
    };
  } catch (err) {
    console.error("[vendors/services] Error in getVendorServices:", err);
    return { services: [], counts: { draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 } };
  }
}

export default async function VendorServicesPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/services");
  }

  const servicesData = await getVendorServices(user.id);

  if (!servicesData) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="card-glass p-8 text-center">
              <h1 className="text-2xl font-bold mb-4 text-red-400">Vendor Account Not Found</h1>
              <p className="text-muted mb-6">
                Your vendor account could not be found. Please contact support.
              </p>
              <a href="/vendors/dashboard" className="btn-secondary">
                Back to Dashboard
              </a>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">My Services</h1>
          <ServicesClient initialServices={servicesData.services || []} initialCounts={servicesData.counts || { draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 }} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
