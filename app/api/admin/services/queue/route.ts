import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClientOrThrow, getAdminDiagnostics, type AdminDiagnostics } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QueueResponse = {
  ok: boolean;
  diagnostics: AdminDiagnostics & {
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
    `keySource=${diagnostics.keySourceName || "none"}`
  );

  return NextResponse.json<QueueResponse>(
    {
      ok: false,
      diagnostics: {
        ...diagnostics,
        queryName,
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
        owner_user_id,
        vendors!services_vendor_id_fkey(business_name, owner_user_id),
        profiles!services_owner_user_id_fkey(email, display_name)
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

    // Normalize services (handle array relations)
    const normalizedServices = (pendingServices || []).map((s: any) => ({
      ...s,
      vendors: Array.isArray(s.vendors) ? s.vendors[0] : s.vendors,
      profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
    }));

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
