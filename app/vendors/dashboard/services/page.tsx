import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import ServicesClient from "@/app/vendors/services/ServicesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getVendorServices(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();

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

    const { data: services, error } = await supabase
      .from("services")
      .select(
        "id, name, title, description, pricing_type, price_cents, status, active, category_id, submitted_at, reviewed_at, rejection_reason, created_at"
      )
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[vendors/dashboard/services] Error fetching services:", error);
      return { services: [], error: error.message };
    }

    const drafts = (services || []).filter((s) => s.status === "draft");
    const pending = (services || []).filter((s) => s.status === "pending_review");
    const approved = (services || []).filter((s) => s.status === "approved");
    const rejected = (services || []).filter((s) => s.status === "rejected");

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
    console.error("[vendors/dashboard/services] Error in getVendorServices:", err);
    return {
      services: [],
      counts: { draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 },
    };
  }
}

export default async function VendorDashboardServicesPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/dashboard/services");
  }

  const servicesData = await getVendorServices(user.id);

  if (!servicesData) {
    redirect("/vendor-registration");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Service Listings</h1>
          <ServicesClient
            initialServices={servicesData.services || []}
            initialCounts={servicesData.counts || { draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 }}
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
