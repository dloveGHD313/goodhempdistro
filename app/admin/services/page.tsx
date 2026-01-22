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
  ok: boolean;
  diagnostics: {
    supabaseUrl: string | null;
    keyPresent: boolean;
    keyType: "jwt" | "sb_secret" | "unknown" | "missing";
    queryName?: string;
  };
  data?: {
    pending: any[];
    counts: {
      total: number;
      draft: number;
      pending_review: number;
      approved: number;
      rejected: number;
    };
    sanityCheck: {
      statusCountsFromGroupBy: Record<string, number>;
      pendingFromQuery: number;
      pendingFromCount: number;
    };
  };
  error?: {
    message: string;
    details?: string;
    hint?: string;
    code?: string;
    status?: number;
    queryContext?: string;
  };
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
  chosenKeyValueLength: number | null;
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
        chosenKeyValueLength: null,
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
        chosenKeyValueLength: null,
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
      const errorData: QueueResponse = await response.json().catch(() => ({
        ok: false,
        diagnostics: {
          supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null,
          keyPresent: false,
          keyType: "missing",
        },
        error: {
          message: `HTTP ${response.status}`,
          status: response.status,
          queryContext: "fetch_error",
        },
      }));
      console.error(`[admin/services] API returned ${response.status}:`, errorData);
      return errorData;
    }

    const data: QueueResponse = await response.json();
    
    if (data.ok && data.data) {
      console.log(`[admin/services] Queue fetched successfully: ${data.data.pending?.length || 0} pending, total: ${data.data.counts?.total || 0}`);
    } else {
      console.error(`[admin/services] Queue API returned error:`, data.error);
    }
    
    return data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/services] Error fetching queue:", err);
    return {
      ok: false,
      diagnostics: {
        supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null,
        keyPresent: false,
        keyType: "missing",
        queryName: "fetch_exception",
      },
      error: {
        message: errorMessage,
        status: 500,
        queryContext: "fetch_exception",
      },
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
    `Queue ok: ${queueData.ok}, ` +
    `Pending: ${queueData.data?.counts?.pending_review || 0}, ` +
    `Diagnostics: ${JSON.stringify(queueData.diagnostics)}, ` +
    `Env chosenKeyName: ${envDiag.chosenKeyName || "null"}`
  );

  // Banner condition depends ONLY on envDiagnostics.chosenKeyName
  // This is the single source of truth for key presence (uses trim-based detection)
  // Whitespace-only values should be treated as missing.
  const noKeyFound = !envDiag.chosenKeyName;
  const diagnosticsFetchFailed = !!envDiag.error;
  const queueFetchFailed = !queueData.ok && envDiag.chosenKeyName; // Key exists but queue failed
  const hasError = diagnosticsFetchFailed || noKeyFound || queueFetchFailed;

  // Map counts to match client component expectations
  const counts = {
    total: queueData.data?.counts?.total || 0,
    pending: queueData.data?.counts?.pending_review || 0,
    approved: queueData.data?.counts?.approved || 0,
    draft: queueData.data?.counts?.draft || 0,
    rejected: queueData.data?.counts?.rejected || 0,
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
              {diagnosticsFetchFailed ? (
                <div className="space-y-2">
                  <p className="text-red-300">
                    <strong>Diagnostics unavailable — cannot verify service role key presence.</strong>
                  </p>
                  <p className="text-sm text-red-200">
                    Error: {envDiag.error}
                  </p>
                </div>
              ) : noKeyFound ? (
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
              ) : queueFetchFailed ? (
                <div className="space-y-3">
                  <p className="text-red-300 text-lg font-bold">
                    ⚠️ Service role key detected ({envDiag.chosenKeyName}) but admin queue failed.
                  </p>
                  {queueData.error && (
                    <div className="bg-red-950/50 border border-red-700 rounded p-4 space-y-2">
                      <p className="text-red-200 font-semibold">
                        <strong>Error Message:</strong> {queueData.error.message}
                      </p>
                      {queueData.error.queryContext && (
                        <p className="text-sm text-red-300">
                          <strong>Failed Query:</strong> <code className="bg-red-900/50 px-2 py-1 rounded">{queueData.error.queryContext}</code>
                        </p>
                      )}
                      {queueData.error.code && (
                        <p className="text-sm text-red-300">
                          <strong>Error Code:</strong> <code className="bg-red-900/50 px-2 py-1 rounded">{queueData.error.code}</code>
                        </p>
                      )}
                      {queueData.error.details && (
                        <div className="text-sm text-red-300">
                          <strong>Details:</strong>
                          <pre className="bg-red-900/30 p-2 rounded mt-1 text-xs overflow-x-auto">{queueData.error.details}</pre>
                        </div>
                      )}
                      {queueData.error.hint && (
                        <div className="text-sm text-red-300 bg-blue-900/20 border border-blue-700 rounded p-2">
                          <strong>💡 Hint:</strong> {queueData.error.hint}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-sm text-red-200 space-y-1">
                    <p className="font-semibold">Possible causes:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>Service role key does not match the Supabase project URL</li>
                      <li>Database schema mismatch (missing columns or tables)</li>
                      <li>RLS policies blocking admin access</li>
                      <li>Wrong Supabase project URL in environment variables</li>
                    </ul>
                    <p className="mt-2">
                      Verify that <code className="bg-red-900/50 px-2 py-1 rounded">SUPABASE_URL</code> matches your project URL and the service role key is from the same project.
                    </p>
                  </div>
                </div>
              ) : null}
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
              {envDiag.chosenKeyName && envDiag.chosenKeyValueLength !== null && (
                <div>
                  <strong>Chosen Key Length:</strong> {envDiag.chosenKeyValueLength} characters
                </div>
              )}
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
                <strong>Supabase URL Used:</strong> {queueData.diagnostics.supabaseUrl || "NOT_SET"}
              </div>
              <div>
                <strong>Service Role Key:</strong>{" "}
                {queueData.diagnostics.keyPresent ? (
                  <span className="text-green-400">✅ Present ({queueData.diagnostics.keyType || "unknown"})</span>
                ) : (
                  <span className="text-red-400">❌ Missing</span>
                )}
              </div>
              {queueData.diagnostics.keyType && (
                <div>
                  <strong>Key Type:</strong> {queueData.diagnostics.keyType}
                </div>
              )}
              {queueData.diagnostics.queryName && (
                <div>
                  <strong>Last Query:</strong> {queueData.diagnostics.queryName}
                </div>
              )}
              {queueData.ok && queueData.data && (
                <>
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
                    <strong>Pending List Length:</strong> {queueData.data.pending?.length || 0}
                  </div>
                  <div>
                    <strong>Sanity Check:</strong>
                    <ul className="ml-4 mt-1 space-y-1">
                      <li>Pending from query: {queueData.data.sanityCheck.pendingFromQuery}</li>
                      <li>Pending from count: {queueData.data.sanityCheck.pendingFromCount}</li>
                      <li>Status counts (group by): {JSON.stringify(queueData.data.sanityCheck.statusCountsFromGroupBy)}</li>
                    </ul>
                  </div>
                </>
              )}
              {queueData.error && (
                <div className="text-red-400 space-y-2 bg-red-950/30 border border-red-700 rounded p-3">
                  <div className="font-semibold text-red-300">
                    ❌ Error Message: {queueData.error.message}
                  </div>
                  {queueData.error.queryContext && (
                    <div>
                      <strong>Query Context:</strong> <code className="bg-red-900/50 px-1 rounded">{queueData.error.queryContext}</code>
                    </div>
                  )}
                  {queueData.error.code && (
                    <div>
                      <strong>Error Code:</strong> <code className="bg-red-900/50 px-1 rounded">{queueData.error.code}</code>
                    </div>
                  )}
                  {queueData.error.details && (
                    <div>
                      <strong>Details:</strong>
                      <pre className="bg-red-900/30 p-2 rounded mt-1 text-xs overflow-x-auto whitespace-pre-wrap">{queueData.error.details}</pre>
                    </div>
                  )}
                  {queueData.error.hint && (
                    <div className="bg-blue-900/20 border border-blue-700 rounded p-2">
                      <strong>💡 Hint:</strong> {queueData.error.hint}
                    </div>
                  )}
                  {queueData.error.status && (
                    <div>
                      <strong>HTTP Status:</strong> {queueData.error.status}
                    </div>
                  )}
                </div>
              )}
            </div>
          </details>

          {queueData.ok && queueData.data ? (
            <ServicesReviewClient 
              initialServices={queueData.data.pending || []} 
              initialCounts={counts} 
            />
          ) : (
            <div className="card-glass p-8 text-center">
              <p className="text-muted">Cannot load services queue. Check the error details above.</p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
