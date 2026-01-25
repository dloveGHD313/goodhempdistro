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
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import ServicesReviewClient from "./ServicesReviewClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = "nodejs";

type QueueResponse = {
  ok: boolean;
  diagnostics: {
    supabaseUrlUsed: string | null;
    urlSourceName: "SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_URL" | "none";
    keyPresent: boolean;
    keySourceName: string | null;
    keyLength: number | null;
    keyType: "jwt" | "sb_secret" | "unknown" | "missing";
    queryName?: string;
    buildTag?: string;
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
          supabaseUrlUsed: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null,
          urlSourceName: process.env.SUPABASE_URL
            ? "SUPABASE_URL"
            : process.env.NEXT_PUBLIC_SUPABASE_URL
              ? "NEXT_PUBLIC_SUPABASE_URL"
              : "none",
          keyPresent: false,
          keySourceName: null,
          keyLength: null,
          keyType: "missing",
          queryName: "fetch_error",
          // If we can't parse JSON, we can't know the buildTag.
          buildTag: undefined,
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
        supabaseUrlUsed: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null,
        urlSourceName: process.env.SUPABASE_URL ? "SUPABASE_URL" : (process.env.NEXT_PUBLIC_SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : "none"),
        keyPresent: false,
        keySourceName: null,
        keyLength: null,
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

  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/services");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const queueData = await fetchQueue();

  console.log(
    `[admin/services] Admin ${adminCheck.user.id} viewing services. ` +
    `Queue ok: ${queueData.ok}, ` +
    `Pending: ${queueData.data?.counts?.pending_review || 0}, ` +
    `Diagnostics: ${JSON.stringify(queueData.diagnostics)}`
  );

  // Trust API diagnostics - no separate key detection logic
  const hasError = !queueData.ok;

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
          {hasError && queueData.error && (
            <div className="mb-6 bg-red-900/30 border-2 border-red-600 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-400 mb-4">⚠️ Admin Queue Error</h2>
              <div className="space-y-3">
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
              </div>
            </div>
          )}

          {/* Admin Diagnostics Panel */}
          <details className="mb-6 surface-card p-4 border border-blue-600/30 rounded-lg bg-blue-900/10">
            <summary className="cursor-pointer text-sm font-semibold text-blue-400 hover:text-blue-300">
              🔍 Admin Diagnostics
            </summary>
            <div className="mt-4 space-y-2 text-xs font-mono">
              <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-600 rounded">
                <strong className="text-yellow-400">Build Tag:</strong>{" "}
                {queueData.diagnostics.buildTag ? (
                  <code className="text-yellow-300 font-bold">{queueData.diagnostics.buildTag}</code>
                ) : (
                  <code className="text-red-300 font-bold">MISSING (API not returning buildTag)</code>
                )}
              </div>
              <div>
                <strong>Supabase URL Used:</strong> {queueData.diagnostics.supabaseUrlUsed || "NOT_SET"}
              </div>
              <div>
                <strong>URL Source:</strong> {queueData.diagnostics.urlSourceName}
              </div>
              <div>
                <strong>Service Role Key:</strong>{" "}
                {queueData.diagnostics.keyPresent ? (
                  <span className="text-green-400">✅ Present</span>
                ) : (
                  <span className="text-red-400">❌ Missing</span>
                )}
              </div>
              {queueData.diagnostics.keySourceName && (
                <div>
                  <strong>Key Source:</strong> {queueData.diagnostics.keySourceName}
                </div>
              )}
              {queueData.diagnostics.keyLength !== null && (
                <div>
                  <strong>Key Length:</strong> {queueData.diagnostics.keyLength} characters
                </div>
              )}
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
