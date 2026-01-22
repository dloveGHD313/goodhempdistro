import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient, getSafeAdminDiagnostics } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
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

/**
 * Helper to create error response with full Supabase error details
 */
function createErrorResponse(
  diagnostics: ReturnType<typeof getSafeAdminDiagnostics>,
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
  console.error(
    `[admin/services/queue] Query failed: ${queryName} ` +
    `code=${supabaseError?.code || "unknown"} ` +
    `url=${diagnostics.supabaseUrl?.substring(0, 50) || "NOT_SET"}... ` +
    `keyPresent=${diagnostics.keyPresent} ` +
    `keyType=${diagnostics.keyType}`
  );

  // Ensure diagnostics structure matches QueueResponse type exactly
  const errorDiagnostics: QueueResponse["diagnostics"] = {
    ...diagnostics,
    queryName,
  };
  
  return NextResponse.json<QueueResponse>(
    {
      ok: false,
      diagnostics: errorDiagnostics,
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
 * Helper to detect and fix common query errors automatically
 */
function detectAndFixQueryError(error: any, queryName: string): {
  fixed: boolean;
  useSubmittedAt?: boolean;
  statusVariants?: string[];
  message?: string;
  isSchemaError?: boolean;
  isTableMissing?: boolean;
} {
  const errorMessage = error?.message?.toLowerCase() || "";
  const errorCode = error?.code || "";
  const errorDetails = error?.details?.toLowerCase() || "";

  // Check for missing table
  if (
    errorMessage.includes("relation") &&
    (errorMessage.includes("does not exist") || errorMessage.includes("not found"))
  ) {
    return {
      fixed: false,
      isTableMissing: true,
      message: `Table 'services' does not exist. Ensure migrations have been run. Error: ${error.message}`,
    };
  }

  // Check for missing schema
  if (
    errorMessage.includes("schema") &&
    (errorMessage.includes("does not exist") || errorMessage.includes("not found"))
  ) {
    return {
      fixed: false,
      isSchemaError: true,
      message: `Schema error. Ensure you're querying 'public.services' and the schema exists. Error: ${error.message}`,
    };
  }

  // Check for missing created_at column
  if (
    (errorMessage.includes("column") || errorDetails.includes("column")) &&
    (errorMessage.includes("created_at") || errorDetails.includes("created_at") ||
     errorMessage.includes("does not exist") || errorDetails.includes("does not exist"))
  ) {
    return {
      fixed: true,
      useSubmittedAt: true,
      message: "Auto-fix: Using submitted_at instead of created_at",
    };
  }

  // Check for status value mismatch (case sensitivity or invalid enum value)
  if (
    errorCode === "PGRST116" ||
    errorCode === "23514" || // PostgreSQL check constraint violation
    errorMessage.includes("invalid input") ||
    errorMessage.includes("status") ||
    (errorMessage.includes("check constraint") && errorMessage.includes("status"))
  ) {
    // Try common status variants (the correct one is 'pending_review' per migration 015)
    return {
      fixed: true,
      statusVariants: ["pending_review", "Pending Review", "PENDING_REVIEW", "pending"],
      message: "Auto-fix: Trying multiple status value variants (expected: 'pending_review')",
    };
  }

  // Check for JWT/signature errors (wrong key for project)
  if (
    errorCode === "PGRST301" ||
    errorCode === "PGRST302" ||
    errorMessage.includes("jwt") ||
    errorMessage.includes("signature") ||
    errorMessage.includes("invalid token") ||
    errorMessage.includes("unauthorized")
  ) {
    return {
      fixed: false,
      message: "Service role key does not match this Supabase project. The key must be from the same project as NEXT_PUBLIC_SUPABASE_URL. Verify the key in Supabase Dashboard → Settings → API → service_role key.",
    };
  }

  // Check for RLS blocking access (shouldn't happen with service role, but log it)
  if (
    errorMessage.includes("permission denied") ||
    errorMessage.includes("row-level security") ||
    errorCode === "42501"
  ) {
    return {
      fixed: false,
      message: "RLS policy blocking access. Service role key should bypass RLS. Verify the key has service_role privileges.",
    };
  }

  return { fixed: false };
}

/**
 * Get pending services queue for admin review
 * Uses service role client to bypass RLS and fetch all services
 * 
 * Whitespace-only values should be treated as missing.
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication using session-based client
    const supabase = await createSupabaseServerClient();
    const { user, profile } = await getCurrentUserProfile(supabase);

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          diagnostics: getSafeAdminDiagnostics(),
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
      return NextResponse.json(
        {
          ok: false,
          diagnostics: getSafeAdminDiagnostics(),
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
    const diagnostics = getSafeAdminDiagnostics();

    // Create admin client (will throw if service role key is missing)
    let admin;
    try {
      admin = getSupabaseAdminClient();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to initialize admin client";
      console.error(`[admin/services/queue] ${errorMessage}`);
      
      // Ensure diagnostics structure matches QueueResponse type exactly
      const errorDiagnostics: QueueResponse["diagnostics"] = {
        ...diagnostics,
        queryName: "admin_client_init",
      };
      
      return NextResponse.json<QueueResponse>(
        {
          ok: false,
          diagnostics: errorDiagnostics,
          error: {
            message: "No server-side service key found (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY / SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE)",
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

    // Connection sanity check: Try a simple query that cannot fail unless connection/key/project is wrong
    const { data: sanityCheckData, error: sanityError } = await admin
      .from("services")
      .select("id")
      .limit(1);

    if (sanityError) {
      const fixInfo = detectAndFixQueryError(sanityError, "connection_sanity_check");
      
      // Provide enhanced error message based on error type
      let errorMessage = fixInfo.message || sanityError.message || "Connection sanity check failed";
      let errorHint = sanityError.hint;

      if (fixInfo.isTableMissing) {
        errorMessage = fixInfo.message || "Table 'services' does not exist";
        errorHint = "Run migrations: supabase/migrations/015_vendor_tiers_product_lifecycle.sql and 016_services_marketplace_complete.sql";
      } else if (fixInfo.isSchemaError) {
        errorMessage = fixInfo.message || "Schema error";
        errorHint = "Ensure you're querying 'public.services' and the public schema exists";
      } else if (fixInfo.message?.includes("does not match")) {
        errorHint = "Verify that SUPABASE_SERVICE_ROLE_KEY matches the project URL in NEXT_PUBLIC_SUPABASE_URL. Get the key from Supabase Dashboard → Settings → API → service_role key";
      } else if (!errorHint) {
        errorHint = "Verify admin client configuration and database connectivity";
      }

      // Ensure diagnostics structure matches QueueResponse type exactly
      const sanityCheckDiagnostics: QueueResponse["diagnostics"] = {
        ...diagnostics,
        queryName: "connection_sanity_check",
      };
      
      return NextResponse.json<QueueResponse>(
        {
          ok: false,
          diagnostics: sanityCheckDiagnostics,
          error: {
            message: errorMessage,
            details: sanityError.details || undefined,
            hint: errorHint,
            code: sanityError.code || undefined,
            status: 500,
            queryContext: "connection_sanity_check",
          },
        },
        {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // Determine which timestamp column to use (try created_at first, fallback to submitted_at)
    let orderByColumn = "created_at";
    let useSubmittedAt = false;

    // Test if created_at exists by trying a simple query
    const { error: createdAtTestError } = await admin
      .from("services")
      .select("created_at")
      .limit(1);

    if (createdAtTestError) {
      const fixInfo = detectAndFixQueryError(createdAtTestError, "column_check");
      if (fixInfo.useSubmittedAt) {
        orderByColumn = "submitted_at";
        useSubmittedAt = true;
        console.log("[admin/services/queue] Auto-fix: Using submitted_at instead of created_at");
      }
    }

    // Fetch pending services with automatic status variant handling
    let pendingServices: any[] = [];
    let pendingError: any = null;
    const statusVariants = ["pending_review", "Pending Review", "PENDING_REVIEW"];

    for (const statusVariant of statusVariants) {
      const query = admin
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
        .eq("status", statusVariant);

      // Use the appropriate order column
      if (useSubmittedAt && orderByColumn === "submitted_at") {
        query.order("submitted_at", { ascending: false });
      } else {
        query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (!error && data) {
        pendingServices = data;
        break;
      }

      if (error && error.code !== "PGRST116") {
        // Not a "no rows" error, this is a real error
        pendingError = error;
        break;
      }
    }

    if (pendingError) {
      // Check if we can auto-fix the error
      const fixInfo = detectAndFixQueryError(pendingError, "pending_list");
      
      // If it's a status mismatch, we already tried variants, so return the error
      // If it's a schema/table error, return enhanced error
      if (fixInfo.isTableMissing || fixInfo.isSchemaError) {
        // Ensure diagnostics structure matches QueueResponse type exactly
        const pendingListDiagnostics: QueueResponse["diagnostics"] = {
          ...diagnostics,
          queryName: "pending_list",
        };
        
        return NextResponse.json<QueueResponse>(
          {
            ok: false,
            diagnostics: pendingListDiagnostics,
            error: {
              message: fixInfo.message || pendingError.message || "Failed to fetch pending services",
              details: pendingError.details || undefined,
              hint: fixInfo.isTableMissing 
                ? "Run migrations: supabase/migrations/015_vendor_tiers_product_lifecycle.sql and 016_services_marketplace_complete.sql"
                : fixInfo.isSchemaError
                ? "Ensure you're querying 'public.services' and the public schema exists"
                : pendingError.hint || undefined,
              code: pendingError.code || undefined,
              status: 500,
              queryContext: "pending_list",
            },
          },
          {
            status: 500,
            headers: { "Cache-Control": "no-store" },
          }
        );
      }

      return createErrorResponse(diagnostics, pendingError, "pending_list", 500);
    }

    // Get counts grouped by status (for sanity check)
    const { data: allServices, error: statusError } = await admin
      .from("services")
      .select("status");

    let statusCounts: Record<string, number> = {};
    if (statusError) {
      // Log but don't fail - this is just for diagnostics
      console.error("[admin/services/queue] Error fetching status counts:", statusError);
      // Don't return error here - this is optional diagnostic data
    } else if (allServices) {
      allServices.forEach((s: { status: string }) => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      });
    }

    // Get accurate counts using count queries (try with status variants)
    let totalCount = 0;
    let draftCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    // Total count
    const { count: total, error: totalError } = await admin
      .from("services")
      .select("*", { count: "exact", head: true });

    if (totalError) {
      return createErrorResponse(diagnostics, totalError, "count_total", 500);
    }
    totalCount = total || 0;

    // Draft count
    const { count: draft, error: draftError } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft");

    if (draftError) {
      // Log but don't fail - counts are for diagnostics only
      console.error("[admin/services/queue] Error fetching draft count:", draftError);
    } else {
      draftCount = draft || 0;
    }

    // Pending count (try variants until one works)
    let pendingCountError: any = null;
    for (const statusVariant of ["pending_review", "Pending Review", "PENDING_REVIEW"]) {
      const { count: pending, error: err } = await admin
        .from("services")
        .select("*", { count: "exact", head: true })
        .eq("status", statusVariant);

      if (!err) {
        pendingCount = pending || 0;
        pendingCountError = null;
        break; // Use first successful variant
      } else {
        // Track error but continue trying variants
        pendingCountError = err;
      }
    }

    // If all variants failed, return error (but only if this is critical)
    // Note: We'll continue even if pending count fails, as the main query might work
    if (pendingCountError && pendingCount === 0) {
      // Log but don't fail - the main query result is more important
      console.error("[admin/services/queue] All pending count variants failed:", pendingCountError);
    }

    // Approved count
    const { count: approved, error: approvedError } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    if (approvedError) {
      // Log but don't fail - counts are for diagnostics only
      console.error("[admin/services/queue] Error fetching approved count:", approvedError);
    } else {
      approvedCount = approved || 0;
    }

    // Rejected count
    const { count: rejected, error: rejectedError } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected");

    if (rejectedError) {
      // Log but don't fail - counts are for diagnostics only
      console.error("[admin/services/queue] Error fetching rejected count:", rejectedError);
    } else {
      rejectedCount = rejected || 0;
    }

    // Normalize services (handle array relations)
    const normalizedServices = (pendingServices || []).map((s: any) => ({
      ...s,
      vendors: Array.isArray(s.vendors) ? s.vendors[0] : s.vendors,
      profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
    }));

    // Log comprehensive diagnostics
    const urlPreview = diagnostics.supabaseUrl?.substring(0, 50) || "NOT_SET";
    console.log(
      `[admin/services/queue] Admin ${user.id} (${user.email}) fetched queue. ` +
      `Pending from query: ${normalizedServices.length}, ` +
      `Pending from count: ${pendingCount}, ` +
      `Total: ${totalCount}, ` +
      `URL: ${urlPreview}..., ` +
      `keyPresent=${diagnostics.keyPresent} keyType=${diagnostics.keyType}`
    );

    return NextResponse.json(
      {
        ok: true,
        diagnostics: {
          ...diagnostics,
          queryName: "success",
        },
        data: {
          pending: normalizedServices,
          counts: {
            total: totalCount,
            draft: draftCount,
            pending_review: pendingCount,
            approved: approvedCount,
            rejected: rejectedCount,
          },
          sanityCheck: {
            statusCountsFromGroupBy: statusCounts,
            pendingFromQuery: normalizedServices.length,
            pendingFromCount: pendingCount,
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
    const diagnostics = getSafeAdminDiagnostics();
    // Ensure diagnostics structure matches QueueResponse type exactly
    const unexpectedErrorDiagnostics: QueueResponse["diagnostics"] = {
      ...diagnostics,
      queryName: "unexpected_error",
    };
    
    return NextResponse.json<QueueResponse>(
      {
        ok: false,
        diagnostics: unexpectedErrorDiagnostics,
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
