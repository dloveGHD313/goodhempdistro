import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClientOrThrow, getAdminDiagnostics, type AdminDiagnostics } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Build tag to verify deployed code version
const BUILD_TAG = "queue-no-joins-2026-01-20-x7k9m";

type QueueResponse = {
  ok: boolean;
  diagnostics: AdminDiagnostics & {
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

/**
 * Helper to create error response with full Supabase error details
 */
function createErrorResponse(
  diagnostics: AdminDiagnostics,
  supabaseError: any,
  queryName: string,
  status: number = 500
): NextResponse<QueueResponse> {
  const errorDetails: QueueResponse["error"] = {
    message: supabaseError?.message || "Unknown error",
    details: supabaseError?.details || undefined,
    hint: supabaseError?.hint || undefined,
    code: supabaseError?.code || undefined,
    status,
    queryContext: queryName,
  };

  // Log safe info only (never log key values)
  const urlPreview = diagnostics.supabaseUrlUsed?.substring(0, 50) || "NOT_SET";
  console.error(
    `[admin/services/queue] Query failed: ${queryName} ` +
    `code=${supabaseError?.code || "unknown"} ` +
    `url=${urlPreview}... ` +
    `keyPresent=${diagnostics.keyPresent} ` +
    `keyType=${diagnostics.keyType} ` +
    `keySource=${diagnostics.keySourceName || "none"} ` +
    `buildTag=${BUILD_TAG}`
  );

  return NextResponse.json<QueueResponse>(
    {
      ok: false,
      diagnostics: {
        ...diagnostics,
        queryName,
        buildTag: BUILD_TAG,
      },
      error: errorDetails,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

/**
 * Get pending services queue for admin review
 * Uses service role client to bypass RLS and fetch all services
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication using session-based client
    const supabase = await createSupabaseServerClient();
    const { user, profile } = await getCurrentUserProfile(supabase);

    if (!user) {
      const diagnostics = getAdminDiagnostics();
      return NextResponse.json<QueueResponse>(
        {
          ok: false,
          diagnostics: {
            ...diagnostics,
            queryName: "auth_check",
            buildTag: BUILD_TAG,
          },
          error: {
            message: "Unauthorized",
            status: 401,
            queryContext: "auth_check",
          },
        },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!isAdmin(profile)) {
      const diagnostics = getAdminDiagnostics();
      return NextResponse.json<QueueResponse>(
        {
          ok: false,
          diagnostics: {
            ...diagnostics,
            queryName: "auth_check",
            buildTag: BUILD_TAG,
          },
          error: {
            message: "Forbidden: Not an admin",
            status: 403,
            queryContext: "auth_check",
          },
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Log marker to confirm this code path is executing
    console.log("[admin/services/queue] JOIN_MARKER_SHOULD_NOT_EXIST");
    console.log(`[admin/services/queue] buildTag=${BUILD_TAG}`);

    // Get diagnostics before attempting to create admin client
    const diagnostics = getAdminDiagnostics();

    // Create admin client (will throw if service role key is missing)
    let admin;
    try {
      admin = getSupabaseAdminClientOrThrow();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to initialize admin client";
      console.error(`[admin/services/queue] ${errorMessage}`);
      
      return NextResponse.json<QueueResponse>(
        {
          ok: false,
          diagnostics: {
            ...diagnostics,
            queryName: "admin_client_init",
            buildTag: BUILD_TAG,
          },
          error: {
            message: errorMessage,
            status: 500,
            queryContext: "admin_client_init",
          },
        },
        {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // Fetch pending services (status = 'pending_review') ordered by created_at desc
    // Note: No embedded joins to avoid PostgREST FK relationship discovery errors
    const { data: pendingServices, error: pendingError } = await admin
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
        owner_user_id
      `)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false });

    if (pendingError) {
      return createErrorResponse(diagnostics, pendingError, "pending_list", 500);
    }

    // Get counts by status
    const { count: totalCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true });

    const { count: draftCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft");

    const { count: pendingCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_review");

    const { count: approvedCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    const { count: rejectedCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected");

    // Return services directly without normalization (no embedded relations)
    const normalizedServices = pendingServices || [];

    // Log comprehensive diagnostics
    const urlPreview = diagnostics.supabaseUrlUsed?.substring(0, 50) || "NOT_SET";
    console.log(
      `[admin/services/queue] Admin ${user.id} (${user.email}) fetched queue. ` +
      `Pending: ${normalizedServices.length}, ` +
      `Total: ${totalCount || 0}, ` +
      `URL: ${urlPreview}... (source: ${diagnostics.urlSourceName}), ` +
      `keyPresent=${diagnostics.keyPresent} keySource=${diagnostics.keySourceName || "none"} keyType=${diagnostics.keyType}`
    );

    return NextResponse.json<QueueResponse>(
      {
        ok: true,
        diagnostics: {
          ...diagnostics,
          queryName: "success",
          buildTag: BUILD_TAG,
        },
        data: {
          pending: normalizedServices,
          counts: {
            total: totalCount || 0,
            draft: draftCount || 0,
            pending_review: pendingCount || 0,
            approved: approvedCount || 0,
            rejected: rejectedCount || 0,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin/services/queue] Unexpected error:", error);
    const diagnostics = getAdminDiagnostics();
    
    return NextResponse.json<QueueResponse>(
      {
        ok: false,
        diagnostics: {
          ...diagnostics,
          queryName: "unexpected_error",
          buildTag: BUILD_TAG,
        },
        error: {
          message: errorMessage,
          status: 500,
          queryContext: "unexpected_error",
        },
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
