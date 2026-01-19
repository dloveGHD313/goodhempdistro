import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import Footer from "@/components/Footer";
import VendorsClient from "./VendorsClient";

export const dynamic = 'force-dynamic';

async function getVendorApplications() {
  const admin = getSupabaseAdminClient();

  const { data: applications, error } = await admin
    .from("vendor_applications")
    .select("id, user_id, business_name, description, status, created_at, updated_at, profiles(display_name, email)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching vendor applications:", error);
    return [];
  }

  return (applications || []).map((app: any) => ({
    ...app,
    profiles: Array.isArray(app.profiles) ? app.profiles[0] : app.profiles,
  }));
}

export default async function AdminVendorsPage() {
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);

  if (!user) {
    redirect("/login?redirect=/admin/vendors");
  }

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  const applications = await getVendorApplications();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Vendor Applications</h1>
          <VendorsClient initialApplications={applications} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
