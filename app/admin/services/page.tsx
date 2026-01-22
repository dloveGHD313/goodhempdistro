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
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import Footer from "@/components/Footer";
import ServicesReviewClient from "./ServicesReviewClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = "nodejs";

type QueueResponse = {
  pending: any[];
  counts: {
    total: number;
    draft: number;
    pending_review: number;
    approved: number;
    rejected: number;
  };
  diagnostics: {
    supabaseUrlUsed: string;
    serviceRoleKeyPresent: boolean;
    serviceRoleKeyType?: "jwt" | "sb_secret" | "unknown" | "missing";
  };
  sanityCheck: {
    statusCountsFromGroupBy: Record<string, number>;
    pendingFromQuery: number;
    pendingFromCount: number;
  };
  error?: string;
  message?: string;
};

type EnvDiagnosticsResponse = {
  has_SUPABASE_SERVICE_ROLE_KEY: boolean;
  has_SUPABASE_SECRET_KEY: boolean;
  has_SUPABASE_SERVICE_KEY: boolean;
  has_SUPABASE_SERVICE_ROLE: boolean;
  has_SUPABASE_URL: boolean;
  has_NEXT_PUBLIC_SUPABASE_URL: boolean;
  has_VERCEL_URL: boolean;
  has_NEXT_PUBLIC_SITE_URL: boolean;
  chosenKeyName: string | null;
  error?: string;
};

async function fetchEnvDiagnostics(): Promise<EnvDiagnosticsResponse> {
  noStore();
  
  try {
    // Construct base URL reliably for both local and production
    let baseUrl: string;
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'http://localhost:3000';
    }
    
    // Ensure no trailing slash
    baseUrl = baseUrl.replace(/\/$/, '');
    
    const apiUrl = `${baseUrl}/api/admin/diag/env`;
    
    // Get cookies to pass for auth
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
    
    const response = await fetch(apiUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        'Cookie': cookieHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[admin/services] Env diagnostics API returned ${response.status}:`, errorData);
      return {
        has_SUPABASE_SERVICE_ROLE_KEY: false,
        has_SUPABASE_SECRET_KEY: false,
        has_SUPABASE_SERVICE_KEY: false,
        has_SUPABASE_SERVICE_ROLE: false,
        has_SUPABASE_URL: false,
        has_NEXT_PUBLIC_SUPABASE_URL: false,
        has_VERCEL_URL: false,
        has_NEXT_PUBLIC_SITE_URL: false,
        chosenKeyName: null,
        error: errorData.error || errorData.message || `HTTP ${response.status}`,
      };
    }

    const data: EnvDiagnosticsResponse = await response.json();
    return data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/services] Error fetching env diagnostics:", err);
    return {
      has_SUPABASE_SERVICE_ROLE_KEY: false,
      has_SUPABASE_SECRET_KEY: false,
      has_SUPABASE_SERVICE_KEY: false,
      has_SUPABASE_SERVICE_ROLE: false,
      has_SUPABASE_URL: false,
      has_NEXT_PUBLIC_SUPABASE_URL: false,
      has_VERCEL_URL: false,
      has_NEXT_PUBLIC_SITE_URL: false,
      chosenKeyName: null,
      error: errorMessage,
    };
  }
}

async function fetchQueue(): Promise<QueueResponse> {
  noStore();
  
  try {
    // Construct base URL reliably for both local and production
    let baseUrl: string;
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'http://localhost:3000';
    }
    
    // Ensure no trailing slash
    baseUrl = baseUrl.replace(/\/$/, '');
    
    const apiUrl = `${baseUrl}/api/admin/services/queue`;
    
    // Get cookies to pass for auth
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
    
    console.log(`[admin/services] Fetching queue from: ${apiUrl}`);
    console.log(`[admin/services] Base URL: ${baseUrl}, Cookies present: ${cookieHeader.length > 0}`);
    
    const response = await fetch(apiUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        'Cookie': cookieHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[admin/services] API returned ${response.status}:`, errorData);
      return {
        pending: [],
        counts: { total: 0, draft: 0, pending_review: 0, approved: 0, rejected: 0 },
        diagnostics: {
          supabaseUrlUsed: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET',
          serviceRoleKeyPresent: false,
        },
        sanityCheck: {
          statusCountsFromGroupBy: {},
          pendingFromQuery: 0,
          pendingFromCount: 0,
        },
        error: errorData.error || errorData.message || `HTTP ${response.status}`,
        message: errorData.message,
      };
    }

    const data: QueueResponse = await response.json();
    console.log(`[admin/services] Queue fetched successfully: ${data.pending?.length || 0} pending, total: ${data.counts?.total || 0}`);
    return data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/services] Error fetching queue:", err);
    return {
      pending: [],
      counts: { total: 0, draft: 0, pending_review: 0, approved: 0, rejected: 0 },
      diagnostics: {
        supabaseUrlUsed: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET',
        serviceRoleKeyPresent: false,
      },
      sanityCheck: {
        statusCountsFromGroupBy: {},
        pendingFromQuery: 0,
        pendingFromCount: 0,
      },
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

  const [queueData, envDiag] = await Promise.all([
    fetchQueue(),
    fetchEnvDiagnostics(),
  ]);

  console.log(
    `[admin/services] Admin ${user.id} (role=${profile?.role ?? "unknown"}) viewing services. ` +
    `Pending: ${queueData.counts?.pending_review || 0}, ` +
    `Diagnostics: ${JSON.stringify(queueData.diagnostics)}, ` +
    `Env chosenKeyName: ${envDiag.chosenKeyName || "null"}`
  );

  // Determine if there's a missing key issue (takes priority over query errors)
  const noKeyFound = !envDiag.chosenKeyName || !queueData.diagnostics.serviceRoleKeyPresent;
  const hasError = !!queueData.error || noKeyFound;

  // Map counts to match client component expectations
  const counts = {
    total: queueData.counts.total || 0,
    pending: queueData.counts.pending_review || 0,
    approved: queueData.counts.approved || 0,
    draft: queueData.counts.draft || 0,
    rejected: queueData.counts.rejected || 0,
  };

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Service Review Queue</h1>
          
          {/* Critical Diagnostics Banner */}
          {hasError && (
            <div className="mb-6 bg-red-900/30 border-2 border-red-600 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-400 mb-4">⚠️ Configuration Error</h2>
              {noKeyFound ? (
                <div className="space-y-2">
                  <p className="text-red-300">
                    <strong>No server-side service key found.</strong>
                  </p>
                  <p className="text-sm text-red-200">
                    Set <strong>ONE</strong> of the following in Vercel Production environment variables:
                  </p>
                  <ul className="text-sm text-red-200 list-disc list-inside ml-4 space-y-1">
                    <li><code className="bg-red-900/50 px-2 py-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> (preferred)</li>
                    <li><code className="bg-red-900/50 px-2 py-1 rounded">SUPABASE_SECRET_KEY</code> (for sb_secret_ format)</li>
                    <li><code className="bg-red-900/50 px-2 py-1 rounded">SUPABASE_SERVICE_KEY</code> (alternative)</li>
                  </ul>
                  <p className="text-sm text-red-200 mt-2">
                    Also ensure <code className="bg-red-900/50 px-2 py-1 rounded">SUPABASE_URL</code> (or <code className="bg-red-900/50 px-2 py-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code>) points to the correct Supabase project.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-red-300">
                    <strong>Query Error:</strong> {queueData.error || queueData.message}
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

          {/* Runtime Environment Diagnostics */}
          <details className="mb-6 surface-card p-4 border border-purple-600/30 rounded-lg bg-purple-900/10">
            <summary className="cursor-pointer text-sm font-semibold text-purple-400 hover:text-purple-300">
              🔧 Runtime Environment Diagnostics
            </summary>
            <div className="mt-4 space-y-2 text-xs font-mono">
              <div>
                <strong>Chosen Key Name:</strong>{" "}
                {envDiag.chosenKeyName ? (
                  <span className="text-green-400">✅ {envDiag.chosenKeyName}</span>
                ) : (
                  <span className="text-red-400">❌ None found</span>
                )}
              </div>
              <div className="mt-3">
                <strong>Service Role Key Env Vars:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>
                    SUPABASE_SERVICE_ROLE_KEY: {envDiag.has_SUPABASE_SERVICE_ROLE_KEY ? (
                      <span className="text-green-400">✅ Present</span>
                    ) : (
                      <span className="text-red-400">❌ Missing</span>
                    )}
                  </li>
                  <li>
                    SUPABASE_SECRET_KEY: {envDiag.has_SUPABASE_SECRET_KEY ? (
                      <span className="text-green-400">✅ Present</span>
                    ) : (
                      <span className="text-red-400">❌ Missing</span>
                    )}
                  </li>
                  <li>
                    SUPABASE_SERVICE_KEY: {envDiag.has_SUPABASE_SERVICE_KEY ? (
                      <span className="text-green-400">✅ Present</span>
                    ) : (
                      <span className="text-red-400">❌ Missing</span>
                    )}
                  </li>
                  <li>
                    SUPABASE_SERVICE_ROLE: {envDiag.has_SUPABASE_SERVICE_ROLE ? (
                      <span className="text-green-400">✅ Present</span>
                    ) : (
                      <span className="text-red-400">❌ Missing</span>
                    )}
                  </li>
                </ul>
              </div>
              <div className="mt-3">
                <strong>Supabase URL Env Vars:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>
                    SUPABASE_URL: {envDiag.has_SUPABASE_URL ? (
                      <span className="text-green-400">✅ Present</span>
                    ) : (
                      <span className="text-red-400">❌ Missing</span>
                    )}
                  </li>
                  <li>
                    NEXT_PUBLIC_SUPABASE_URL: {envDiag.has_NEXT_PUBLIC_SUPABASE_URL ? (
                      <span className="text-green-400">✅ Present</span>
                    ) : (
                      <span className="text-red-400">❌ Missing</span>
                    )}
                  </li>
                </ul>
              </div>
              {envDiag.error && (
                <div className="text-red-400 mt-2">
                  <strong>Error:</strong> {envDiag.error}
                </div>
              )}
            </div>
          </details>

          {/* Admin Diagnostics Panel */}
          <details className="mb-6 surface-card p-4 border border-blue-600/30 rounded-lg bg-blue-900/10">
            <summary className="cursor-pointer text-sm font-semibold text-blue-400 hover:text-blue-300">
              🔍 Admin Diagnostics
            </summary>
            <div className="mt-4 space-y-2 text-xs font-mono">
              <div>
                <strong>Supabase URL Used:</strong> {queueData.diagnostics.supabaseUrlUsed}
              </div>
              <div>
                <strong>Service Role Key:</strong>{" "}
                {queueData.diagnostics.serviceRoleKeyPresent ? (
                  <span className="text-green-400">✅ Present ({queueData.diagnostics.serviceRoleKeyType || "unknown"})</span>
                ) : (
                  <span className="text-red-400">❌ Missing</span>
                )}
              </div>
              {queueData.diagnostics.serviceRoleKeyType && (
                <div>
                  <strong>Key Type:</strong> {queueData.diagnostics.serviceRoleKeyType}
                </div>
              )}
              <div>
                <strong>Status Counts (from DB):</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>Total: {counts.total}</li>
                  <li>Pending Review: {counts.pending}</li>
                  <li>Approved: {counts.approved}</li>
                  <li>Draft: {counts.draft}</li>
                  <li>Rejected: {counts.rejected}</li>
                </ul>
              </div>
              <div>
                <strong>Pending List Length:</strong> {queueData.pending?.length || 0}
              </div>
              <div>
                <strong>Sanity Check:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>Pending from query: {queueData.sanityCheck.pendingFromQuery}</li>
                  <li>Pending from count: {queueData.sanityCheck.pendingFromCount}</li>
                  <li>Status counts (group by): {JSON.stringify(queueData.sanityCheck.statusCountsFromGroupBy)}</li>
                </ul>
              </div>
              {queueData.error && (
                <div className="text-red-400">
                  <strong>Error:</strong> {queueData.error}
                </div>
              )}
            </div>
          </details>

          <ServicesReviewClient 
            initialServices={queueData.pending || []} 
            initialCounts={counts} 
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
