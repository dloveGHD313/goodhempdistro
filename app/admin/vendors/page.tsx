import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import Footer from "@/components/Footer";
import VendorsClient from "./VendorsClient";

// Disable caching to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      console.error("[admin/vendors] PostgREST error fetching vendor applications:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return { all: [], pending: [], recent: [] };
    }

    if (!applications) {
      console.warn("[admin/vendors] No applications returned (null/undefined)");
      return { all: [], pending: [], recent: [] };
    }

    // Normalize profiles relation
    const normalized = applications.map((app: any) => ({
      ...app,
      profiles: Array.isArray(app.profiles) ? app.profiles[0] : app.profiles,
    }));

    // Filter by status (case-insensitive comparison)
    const pending = normalized.filter((app: any) => 
      app.status && app.status.toLowerCase() === 'pending'
    );
    
    // Get most recent 10 applications of any status (for diagnostics)
    const recent = normalized.slice(0, 10);

    console.log(`[admin/vendors] Fetched ${normalized.length} total applications: ${pending.length} pending, ${normalized.length - pending.length} other statuses`);

    return { all: normalized, pending, recent };
  } catch (error) {
    console.error("[admin/vendors] Exception in getVendorApplications:", error);
    return { all: [], pending: [], recent: [] };
  }
}

export default async function AdminVendorsPage() {
  // Disable caching
  noStore();
  
  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);

  // Log admin access attempt
  console.log(`[admin/vendors] Admin access attempt: userId=${user?.id || 'null'} email=${user?.email || 'null'} isAdmin=${isAdmin(profile)}`);

  if (!user) {
    console.warn("[admin/vendors] Unauthenticated access attempt - redirecting to login");
    redirect("/login?redirect=/admin/vendors");
  }

  if (!isAdmin(profile)) {
    console.warn(`[admin/vendors] Non-admin access attempt - userId=${user.id} profileRole=${profile?.role || 'null'}`);
    redirect("/dashboard");
  }

  // Fetch applications using service role
  const { all: allApplications, pending: pendingApplications, recent: recentApplications } = await getVendorApplications();
  
  console.log(`[admin/vendors] Admin ${user.email} viewing applications: total=${allApplications.length} pending=${pendingApplications.length}`);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Vendor Applications</h1>
          
          {/* Summary Stats */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface-card p-4 border border-[var(--border)] rounded-lg">
              <div className="text-sm text-muted mb-1">Total Applications</div>
              <div className="text-2xl font-bold">{allApplications.length}</div>
            </div>
            <div className="surface-card p-4 border border-yellow-600/50 rounded-lg bg-yellow-900/10">
              <div className="text-sm text-muted mb-1">Pending Review</div>
              <div className="text-2xl font-bold text-yellow-400">{pendingApplications.length}</div>
            </div>
          </div>

          {/* Pending Applications */}
          {pendingApplications.length > 0 ? (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Pending Applications ({pendingApplications.length})</h2>
              <VendorsClient initialApplications={pendingApplications} />
            </div>
          ) : (
            <div className="mb-8">
              <div className="surface-card p-6 border border-[var(--border)] rounded-lg text-center">
                <p className="text-muted mb-4">No pending applications at this time.</p>
                
                {/* Show recent applications for diagnostics if no pending */}
                {recentApplications.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-[var(--border)]">
                    <h3 className="text-lg font-semibold mb-3">Recent Applications (Last 10)</h3>
                    <div className="text-sm text-muted space-y-2">
                      {recentApplications.map((app: any) => (
                        <div key={app.id} className="flex justify-between items-center p-2 bg-[var(--surface)]/50 rounded">
                          <span>{app.business_name}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            app.status?.toLowerCase() === 'pending' ? 'bg-yellow-900/30 text-yellow-400' :
                            app.status?.toLowerCase() === 'approved' ? 'bg-green-900/30 text-green-400' :
                            app.status?.toLowerCase() === 'rejected' ? 'bg-red-900/30 text-red-400' :
                            'bg-gray-900/30 text-gray-400'
                          }`}>
                            {app.status || 'unknown'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted mt-4">
                      💡 If you expected pending applications, check for status casing differences (e.g., "Pending" vs "pending")
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All Applications (if there are non-pending) */}
          {allApplications.length > pendingApplications.length && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">All Applications</h2>
              <VendorsClient initialApplications={allApplications} />
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
