import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import Footer from "@/components/Footer";
import ServicesReviewClient from "./ServicesReviewClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getPendingServices() {
  try {
    const admin = getSupabaseAdminClient();

    const { data: services, error } = await admin
      .from("services")
      .select(`
        id,
        name,
        title,
        description,
        pricing_type,
        price_cents,
        status,
        submitted_at,
        category_id,
        vendor_id,
        owner_user_id,
        vendors!services_vendor_id_fkey(business_name, owner_user_id),
        profiles!services_owner_user_id_fkey(email, display_name)
      `)
      .eq("status", "pending_review")
      .order("submitted_at", { ascending: true });

    if (error) {
      console.error("[admin/services] Error fetching pending services:", error);
      return { services: [], error: error.message };
    }

    // Get all services counts for overview
    const { count: totalCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true });

    const { count: approvedCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    const { count: draftCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft");

    const { count: rejectedCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected");

    // Normalize services (handle array relations)
    const normalizedServices = (services || []).map((s: any) => ({
      ...s,
      vendors: Array.isArray(s.vendors) ? s.vendors[0] : s.vendors,
      profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
    }));

    return {
      services: normalizedServices,
      counts: {
        total: totalCount || 0,
        pending: normalizedServices.length,
        approved: approvedCount || 0,
        draft: draftCount || 0,
        rejected: rejectedCount || 0,
      },
    };
  } catch (err) {
    console.error("[admin/services] Error in getPendingServices:", err);
    return {
      services: [],
      counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
    };
  }
}

export default async function AdminServicesPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);

  if (!user) {
    redirect("/login?redirect=/admin/services");
  }

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  const servicesData = await getPendingServices();

  console.log(`[admin/services] Admin ${user.id} viewing services. Pending: ${servicesData.counts?.pending || 0}`);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Service Review Queue</h1>
          <ServicesReviewClient 
            initialServices={servicesData.services || []} 
            initialCounts={servicesData.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 }} 
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
