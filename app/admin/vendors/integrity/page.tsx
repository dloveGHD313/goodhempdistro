import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import IntegrityClient from "./IntegrityClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getIntegrityData() {
  const admin = getSupabaseAdminClient();

  // Get all approved vendor applications
  const { data: approvedApplications, error: appsError } = await admin
    .from("vendor_applications")
    .select("id, user_id, business_name, status, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (appsError) {
    console.error("[admin/vendors/integrity] Error fetching applications:", appsError);
    return { 
      missingVendors: [], 
      counts: { approvedApplications: 0, activeVendors: 0, missing: 0 },
      error: appsError.message 
    };
  }

  // Check which approved applications are missing vendor rows
  const missingVendors: Array<{
    application_id: string;
    user_id: string;
    business_name: string;
    created_at: string;
  }> = [];

  if (approvedApplications) {
    for (const app of approvedApplications) {
      const { data: vendor } = await admin
        .from("vendors")
        .select("id")
        .eq("owner_user_id", app.user_id)
        .maybeSingle();

      if (!vendor) {
        missingVendors.push({
          application_id: app.id,
          user_id: app.user_id,
          business_name: app.business_name,
          created_at: app.created_at,
        });
      }
    }
  }

  // Get total counts
  const { count: totalApplications } = await admin
    .from("vendor_applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");

  const { count: totalVendors } = await admin
    .from("vendors")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  return {
    missingVendors,
    counts: {
      approvedApplications: totalApplications || 0,
      activeVendors: totalVendors || 0,
      missing: missingVendors.length,
    },
  };
}

export default async function VendorIntegrityPage() {
  noStore();

  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/vendors/integrity");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const integrityData = await getIntegrityData();

  console.log(
    `[admin/vendors/integrity] Admin ${adminCheck.user.id} viewing integrity. Missing vendors: ${integrityData.counts?.missing || 0}`
  );

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Vendor Integrity Checker</h1>
          <IntegrityClient initialData={integrityData} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
