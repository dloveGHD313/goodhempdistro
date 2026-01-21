import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { hasVendorContext } from "@/lib/authz";
import Footer from "@/components/Footer";
import SettingsClient from "./SettingsClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getVendorProfile(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: vendor, error } = await supabase
      .from("vendors")
      .select("id, owner_user_id, tier, vendor_type, vendor_types, business_name")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[vendors/settings] Error fetching vendor:", error);
      return null;
    }

    return vendor;
  } catch (err) {
    console.error("[vendors/settings] Error in getVendorProfile:", err);
    return null;
  }
}

export default async function VendorSettingsPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/settings");
  }

  // Check vendor context
  const { hasContext } = await hasVendorContext(supabase, user.id);

  if (!hasContext) {
    redirect("/vendor-registration");
  }

  const vendor = await getVendorProfile(user.id);

  if (!vendor) {
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
          <h1 className="text-4xl font-bold mb-8 text-accent">Vendor Settings</h1>
          <SettingsClient initialVendor={vendor} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
