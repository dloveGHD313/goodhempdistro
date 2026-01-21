/**
 * Admin Services Review Queue
 * 
 * MANUAL SETUP REQUIRED:
 * If this page shows "SUPABASE_SERVICE_ROLE_KEY is missing" in the diagnostics banner:
 * 1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
 * 2. Add: SUPABASE_SERVICE_ROLE_KEY = <your-service-role-key>
 * 3. Add (if not present): SUPABASE_URL = <your-supabase-url> (or use NEXT_PUBLIC_SUPABASE_URL)
 * 4. Redeploy the application
 * 
 * The service role key is required for admin pages to bypass RLS and read all services.
 * Without it, the page will show 0 pending services even if they exist.
 */

import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient, getAdminClientDiagnostics, type AdminClientDiagnostics } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import Footer from "@/components/Footer";
import ServicesReviewClient from "./ServicesReviewClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ServicesData = {
  services: any[];
  counts: {
    total: number;
    pending: number;
    approved: number;
    draft: number;
    rejected: number;
  };
  diagnostics: AdminClientDiagnostics;
  error?: string;
};

async function getPendingServices(): Promise<ServicesData> {
  const diagnostics = getAdminClientDiagnostics();
  
  // Check if service role key is missing before attempting to create client
  if (!diagnostics.serviceRoleKeyPresent) {
    console.error("[admin/services] MISSING SUPABASE_SERVICE_ROLE_KEY – cannot fetch pending services");
    return {
      services: [],
      counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
      diagnostics,
      error: "SUPABASE_SERVICE_ROLE_KEY is missing. Set it in Vercel Production environment variables and redeploy.",
    };
  }

  try {
    const admin = getSupabaseAdminClient();

    console.log(`[admin/services] Fetching pending services with filter: status = 'pending_review', URL=${diagnostics.supabaseUrl.substring(0, 50)}...`);

    // Query pending services - ensure exact status match
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
        created_at,
        category_id,
        vendor_id,
        owner_user_id,
        vendors!services_vendor_id_fkey(business_name, owner_user_id),
        profiles!services_owner_user_id_fkey(email, display_name)
      `)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false }); // Newest first (fallback to submitted_at if created_at missing)

    if (error) {
      console.error("[admin/services] Error fetching pending services:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        SUPABASE_URL: diagnostics.supabaseUrl,
        SERVICE_ROLE_KEY: diagnostics.serviceRoleKeyPresent ? "present" : "missing",
      });
      return {
        services: [],
        counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
        diagnostics,
        error: `Query failed: ${error.message}. Check if SUPABASE_URL points to the correct project.`,
      };
    }

    console.log(
      `[admin/services] Raw pending services rows returned: ${services?.length ?? 0}, ` +
      `SUPABASE_URL=${diagnostics.supabaseUrl.substring(0, 50)}..., ` +
      `SERVICE_ROLE_KEY=present`
    );

    // Get all services to compute status counts
    const { data: allServices, error: statusQueryError } = await admin
      .from("services")
      .select("status");

    let statusCounts: Record<string, number> = {};
    if (!statusQueryError && allServices) {
      allServices.forEach((s: { status: string }) => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      });
    }

    console.log(
      `[admin/services] Status counts from DB: ${JSON.stringify(statusCounts)}, ` +
      `SUPABASE_URL=${diagnostics.supabaseUrl.substring(0, 50)}..., ` +
      `SERVICE_ROLE_KEY=present`
    );

    if (statusQueryError) {
      console.error("[admin/services] Error fetching status counts:", statusQueryError);
    }

    // Get counts using count queries for accuracy
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

    const { count: pendingCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_review");

    console.log("[admin/services] Service counts:", {
      totalCount,
      approvedCount,
      draftCount,
      rejectedCount,
      pendingCount,
      pendingFromQuery: services?.length ?? 0,
    });

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
        pending: pendingCount || normalizedServices.length,
        approved: approvedCount || 0,
        draft: draftCount || 0,
        rejected: rejectedCount || 0,
      },
      diagnostics,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/services] Error in getPendingServices:", err);
    return {
      services: [],
      counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
      diagnostics,
      error: errorMessage,
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

  console.log(
    `[admin/services] Admin ${user.id} (role=${profile?.role ?? "unknown"}) viewing services. Pending: ${
      servicesData.counts?.pending || 0
    }, Diagnostics: ${JSON.stringify(servicesData.diagnostics)}`
  );

  const hasError = !!servicesData.error || !servicesData.diagnostics.serviceRoleKeyPresent;

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Service Review Queue</h1>
          
          {/* Critical Diagnostics Banner */}
          {hasError && (
            <div className="mb-6 bg-red-900/30 border-2 border-red-600 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-400 mb-4">⚠️ Configuration Error</h2>
              {!servicesData.diagnostics.serviceRoleKeyPresent ? (
                <div className="space-y-2">
                  <p className="text-red-300">
                    <strong>SUPABASE_SERVICE_ROLE_KEY is missing.</strong>
                  </p>
                  <p className="text-sm text-red-200">
                    Set <code className="bg-red-900/50 px-2 py-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> in Vercel Production environment variables and redeploy.
                  </p>
                  <p className="text-sm text-red-200">
                    Also ensure <code className="bg-red-900/50 px-2 py-1 rounded">SUPABASE_URL</code> (or <code className="bg-red-900/50 px-2 py-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code>) points to the correct Supabase project.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-red-300">
                    <strong>Query Error:</strong> {servicesData.error}
                  </p>
                  <p className="text-sm text-red-200">
                    Your deployment may be pointing at a different Supabase project than the one you updated with SQL migrations.
                  </p>
                  <p className="text-sm text-red-200">
                    Check that <code className="bg-red-900/50 px-2 py-1 rounded">SUPABASE_URL</code> matches your project URL.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Admin Diagnostics Panel */}
          <details className="mb-6 surface-card p-4 border border-blue-600/30 rounded-lg bg-blue-900/10">
            <summary className="cursor-pointer text-sm font-semibold text-blue-400 hover:text-blue-300">
              🔍 Admin Diagnostics
            </summary>
            <div className="mt-4 space-y-2 text-xs font-mono">
              <div>
                <strong>Supabase URL:</strong> {servicesData.diagnostics.supabaseUrl}
              </div>
              <div>
                <strong>Service Role Key:</strong>{" "}
                {servicesData.diagnostics.serviceRoleKeyPresent ? (
                  <span className="text-green-400">✅ Present</span>
                ) : (
                  <span className="text-red-400">❌ Missing</span>
                )}
              </div>
              <div>
                <strong>Status Counts:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>Total: {servicesData.counts.total}</li>
                  <li>Pending Review: {servicesData.counts.pending}</li>
                  <li>Approved: {servicesData.counts.approved}</li>
                  <li>Draft: {servicesData.counts.draft}</li>
                  <li>Rejected: {servicesData.counts.rejected}</li>
                </ul>
              </div>
              {servicesData.error && (
                <div className="text-red-400">
                  <strong>Error:</strong> {servicesData.error}
                </div>
              )}
            </div>
          </details>

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
