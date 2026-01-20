import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import Footer from "@/components/Footer";
import VendorsClient from "./VendorsClient";

export const dynamic = 'force-dynamic';

async function getVendorApplications() {
  try {
    // Use service role client to bypass RLS - server-only
    const admin = getSupabaseAdminClient();

    // Fetch all applications (admin can see all statuses)
    const { data: applications, error } = await admin
      .from("vendor_applications")
      .select("id, user_id, business_name, description, status, created_at, updated_at, profiles(display_name, email)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/vendors] Error fetching vendor applications:", error);
      console.error("[admin/vendors] Error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    if (!applications) {
      console.warn("[admin/vendors] No applications returned (null/undefined)");
      return [];
    }

    console.log(`[admin/vendors] Fetched ${applications.length} vendor applications using service role client`);

    // Normalize profiles relation
    return applications.map((app: any) => ({
      ...app,
      profiles: Array.isArray(app.profiles) ? app.profiles[0] : app.profiles,
    }));
  } catch (error) {
    console.error("[admin/vendors] Exception in getVendorApplications:", error);
    return [];
  }
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

  const allApplications = await getVendorApplications();
  
  // Filter for pending applications (admin can see all, but highlight pending)
  const pendingApplications = allApplications.filter((app: any) => app.status === "pending");
  const otherApplications = allApplications.filter((app: any) => app.status !== "pending");

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Vendor Applications</h1>
          <div className="mb-4 text-muted">
            {pendingApplications.length > 0 ? (
              <p>Found {pendingApplications.length} pending application{pendingApplications.length !== 1 ? 's' : ''} requiring review.</p>
            ) : (
              <p>No pending applications at this time.</p>
            )}
          </div>
          <VendorsClient initialApplications={allApplications} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
