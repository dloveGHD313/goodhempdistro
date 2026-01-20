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

type RPCApplication = {
  id: string;
  user_id: string;
  business_name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  user_email: string | null;
};

async function getVendorApplications(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  try {
    // Use RPC function that bypasses RLS (admin-only check inside function)
    const { data: applications, error } = await supabase.rpc('admin_list_vendor_applications');

    if (error) {
      console.error("[admin/vendors] RPC error fetching vendor applications:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return { 
        all: [], 
        pending: [], 
        recent: [], 
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      };
    }

    if (!applications) {
      console.warn("[admin/vendors] No applications returned from RPC (null/undefined)");
      return { all: [], pending: [], recent: [], error: null };
    }

    // Normalize to match VendorsClient expected format
    type NormalizedApp = {
      id: string;
      user_id: string;
      business_name: string;
      description: string | null;
      status: "pending" | "approved" | "rejected";
      created_at: string;
      updated_at: string;
      profiles: {
        display_name: string | null;
        email?: string;
      } | null;
    };
    
    // Build initial normalized array
    const normalized: NormalizedApp[] = (applications as RPCApplication[]).map((app) => ({
      id: app.id,
      user_id: app.user_id,
      business_name: app.business_name,
      description: app.description,
      status: (app.status.toLowerCase() === 'pending' ? 'pending' : 
               app.status.toLowerCase() === 'approved' ? 'approved' : 
               'rejected') as "pending" | "approved" | "rejected",
      created_at: app.created_at,
      updated_at: app.updated_at,
      profiles: app.user_email ? {
        email: app.user_email,
        display_name: null,
      } : null,
    }));

    // Identify applications with missing emails
    const missingEmailUserIds = normalized
      .filter(app => !app.profiles?.email)
      .map(app => app.user_id);

    // Lookup missing emails from auth.users using service role client
    const emailMap = new Map<string, string>();
    if (missingEmailUserIds.length > 0) {
      try {
        const adminClient = getSupabaseAdminClient();
        // Fetch emails in parallel (batch lookup)
        const emailPromises = missingEmailUserIds.map(async (userId) => {
          try {
            const { data: authUser, error } = await adminClient.auth.admin.getUserById(userId);
            if (!error && authUser?.user?.email) {
              return { userId, email: authUser.user.email };
            }
            return null;
          } catch (err) {
            console.warn(`[admin/vendors] Failed to lookup email for userId=${userId}:`, err);
            return null;
          }
        });

        const emailResults = await Promise.all(emailPromises);
        emailResults.forEach((result) => {
          if (result) {
            emailMap.set(result.userId, result.email);
          }
        });

        // Log warnings for any that still couldn't be found
        missingEmailUserIds.forEach((userId) => {
          if (!emailMap.has(userId)) {
            console.warn(`[admin/vendors] Missing applicant email userId=${userId} - email not found in auth.users`);
          }
        });
      } catch (error) {
        // If service role client fails (e.g., key missing), log but don't break
        console.error("[admin/vendors] Failed to initialize admin client for email lookup:", error);
        missingEmailUserIds.forEach((userId) => {
          console.warn(`[admin/vendors] Missing applicant email userId=${userId} - admin client unavailable`);
        });
      }
    }

    // Update normalized apps with looked-up emails
    const normalizedWithEmails = normalized.map((app) => {
      // If email is missing from profiles, try emailMap
      if (!app.profiles?.email && emailMap.has(app.user_id)) {
        return {
          ...app,
          profiles: {
            email: emailMap.get(app.user_id)!,
            display_name: null,
          },
        };
      }
      // If still no email, keep null but log was already done above
      return app;
    });

    // Filter by status (case-insensitive comparison)
    const pending = normalizedWithEmails.filter((app) => 
      app.status && app.status.toLowerCase() === 'pending'
    );
    
    // Get most recent 10 applications of any status (for diagnostics)
    const recent = normalizedWithEmails.slice(0, 10);

    console.log(`[admin/vendors] RPC returned ${normalizedWithEmails.length} total applications: ${pending.length} pending, ${normalizedWithEmails.length - pending.length} other statuses`);

    return { all: normalizedWithEmails, pending, recent, error: null };
  } catch (error) {
    console.error("[admin/vendors] Exception in getVendorApplications:", error);
    return { 
      all: [], 
      pending: [], 
      recent: [], 
      error: error instanceof Error ? {
        code: 'EXCEPTION',
        message: error.message,
        details: null,
        hint: null,
      } : null
    };
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

  // Verify admin role by reading profile directly
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .maybeSingle();

  const isUserAdmin = profileData?.role === 'admin';

  if (!isUserAdmin) {
    console.warn(`[admin/vendors] Non-admin access attempt - userId=${user.id} profileRole=${profileData?.role || 'null'} profileExists=${!!profileData}`);
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="surface-card p-8 text-center">
              <h1 className="text-2xl font-bold mb-4 text-red-400">Not Authorized</h1>
              <p className="text-muted mb-4">You must be an admin to access this page.</p>
              <p className="text-sm text-muted">
                Your role: {profileData?.role || 'not found'}
                {profileError && ` (Error: ${profileError.message})`}
              </p>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  // Fetch applications using RPC (no service role required)
  const { all: allApplications, pending: pendingApplications, recent: recentApplications, error: rpcError } = await getVendorApplications(supabase);
  
  const totalCount = allApplications.length;
  const pendingCount = pendingApplications.length;
  
  console.log(`[admin/vendors] Admin ${user.email} viewing applications: total=${totalCount} pending=${pendingCount}`);

  // Get Supabase URL for diagnostics
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET';
  const supabaseProjectRef = supabaseUrl.includes('supabase.co') 
    ? supabaseUrl.split('//')[1]?.split('.')[0] || 'unknown'
    : 'local/custom';

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Vendor Applications</h1>
          
          {/* Diagnostics Panel (Admin Only) */}
          <details className="mb-6 surface-card p-4 border border-blue-600/30 rounded-lg bg-blue-900/10">
            <summary className="cursor-pointer text-sm font-semibold text-blue-400 hover:text-blue-300">
              🔍 Diagnostics
            </summary>
            <div className="mt-4 space-y-2 text-xs font-mono">
              <div><strong>Supabase URL:</strong> {supabaseUrl}</div>
              <div><strong>Project Ref:</strong> {supabaseProjectRef}</div>
              <div><strong>User ID:</strong> {user.id}</div>
              <div><strong>User Email:</strong> {user.email || 'no-email'}</div>
              <div><strong>Profile Role:</strong> {profileData?.role || 'NOT FOUND'}</div>
              <div><strong>Profile Email:</strong> {profileData?.email || 'NOT FOUND'}</div>
              <div><strong>Total Applications:</strong> {totalCount}</div>
              <div><strong>Pending Applications:</strong> {pendingCount}</div>
              {rpcError && (
                <div className="mt-4 p-2 bg-red-900/30 border border-red-600 rounded">
                  <div><strong>RPC Error Code:</strong> {rpcError.code}</div>
                  <div><strong>RPC Error Message:</strong> {rpcError.message}</div>
                  {rpcError.details && <div><strong>Details:</strong> {rpcError.details}</div>}
                  {rpcError.hint && <div><strong>Hint:</strong> {rpcError.hint}</div>}
                </div>
              )}
              {totalCount === 0 && (
                <div className="mt-4 p-2 bg-yellow-900/30 border border-yellow-600 rounded">
                  <div><strong>⚠️ No applications found.</strong></div>
                  <div className="mt-2">Possible causes:</div>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Wrong Supabase project (check URL above)</li>
                    <li>Admin role missing (check Profile Role above)</li>
                    <li>Profile row missing (check Profile Email above)</li>
                    <li>No applications exist in database</li>
                  </ul>
                </div>
              )}
            </div>
          </details>
          
          {/* Summary Stats */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface-card p-4 border border-[var(--border)] rounded-lg">
              <div className="text-sm text-muted mb-1">Total Applications</div>
              <div className="text-2xl font-bold">{totalCount}</div>
            </div>
            <div className="surface-card p-4 border border-yellow-600/50 rounded-lg bg-yellow-900/10">
              <div className="text-sm text-muted mb-1">Pending Review</div>
              <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
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
