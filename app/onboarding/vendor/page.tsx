import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Footer from "@/components/Footer";
import { createSupabaseServerClient } from "@/lib/supabase";
import VendorOnboardingClient from "./VendorOnboardingClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export default async function VendorOnboardingPage() {
  noStore();
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`/login?redirect=${encodeURIComponent("/onboarding/vendor")}`);
  }

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select(
      "id, business_name, vendor_type, contact_email, contact_phone, website, state, city, service_areas, vendor_onboarding_step, vendor_onboarding_completed, terms_accepted_at, compliance_acknowledged_at, is_active, is_approved, status"
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const vendorErrorMessage =
    vendorError && typeof vendorError === "object" && "message" in vendorError
      ? String((vendorError as { message?: string }).message || "")
      : null;

  if (!vendor) {
    redirect("/vendor-registration");
  }

  const onboardingComplete =
    vendor.vendor_onboarding_completed &&
    vendor.terms_accepted_at &&
    vendor.compliance_acknowledged_at;

  if (onboardingComplete) {
    redirect("/vendors/dashboard");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <VendorOnboardingClient
            initialVendor={vendor}
            initialError={vendorErrorMessage}
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
