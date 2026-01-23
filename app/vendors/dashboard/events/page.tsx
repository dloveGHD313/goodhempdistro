import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VendorDashboardEventsPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/dashboard/events");
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, vendor_onboarding_completed, terms_accepted_at, compliance_acknowledged_at")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!vendor) {
    redirect("/vendor-registration");
  }

  if (!vendor.vendor_onboarding_completed || !vendor.terms_accepted_at || !vendor.compliance_acknowledged_at) {
    redirect("/onboarding/vendor");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-6 text-accent">Event Listings</h1>
          <div className="card-glass p-6">
            <p className="text-muted mb-4">
              Event management is coming next. You can continue using the existing event tools.
            </p>
            <Link href="/vendors/events" className="btn-primary">
              Go to Events
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
