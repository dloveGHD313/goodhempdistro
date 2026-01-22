import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient, getAdminClientDiagnostics } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(profile)) {
      return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
    }

    // Get diagnostics before attempting to create admin client
    // Uses the same trim-based key detection as getServiceRoleKey() in lib/supabaseAdmin.ts
    // Whitespace-only values should be treated as missing.
    const diagnostics = getAdminClientDiagnostics();
    
    // Log safe diagnostics (never log the key itself)
    console.log(
      `[admin/services/queue] url=${diagnostics.supabaseUrl.substring(0, 50)}... ` +
      `keyPresent=${diagnostics.serviceRoleKeyPresent} ` +
      `keyType=${diagnostics.serviceRoleKeyType}`
    );

    // Create admin client (will throw if service role key is missing)
    // getSupabaseAdminClient() uses getServiceRoleKey() which trims and checks each env var
    let admin;
    try {
      admin = getSupabaseAdminClient();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to initialize admin client";
      console.error(`[admin/services/queue] ${errorMessage}`);
      return NextResponse.json(
        {
          error: "Server configuration error",
          message: "No server-side service key found (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY / SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE)",
          diagnostics: {
            ...diagnostics,
            chosenKeyName: null, // Explicitly indicate no key was found
          },
          pending: [],
          counts: {
            total: 0,
            draft: 0,
            pending_review: 0,
            approved: 0,
            rejected: 0,
          },
          sanityCheck: {
            statusCountsFromGroupBy: {},
            pendingFromQuery: 0,
            pendingFromCount: 0,
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

    // Fetch pending services (status = 'pending_review')
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
      .order("created_at", { ascending: false }); // Newest first

    if (pendingError) {
      console.error("[admin/services/queue] Error fetching pending services:", {
        message: pendingError.message,
        details: pendingError.details,
        hint: pendingError.hint,
        code: pendingError.code,
        url: diagnostics.supabaseUrl.substring(0, 50) + "...",
        keyPresent: diagnostics.serviceRoleKeyPresent,
        keyType: diagnostics.serviceRoleKeyType,
      });
      return NextResponse.json(
        {
          error: "Query failed",
          message: pendingError.message,
          diagnostics,
          pending: [],
          counts: {
            total: 0,
            draft: 0,
            pending_review: 0,
            approved: 0,
            rejected: 0,
          },
          sanityCheck: {
            statusCountsFromGroupBy: {},
            pendingFromQuery: 0,
            pendingFromCount: 0,
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

    // Sanity check: Get counts grouped by status
    const { data: allServices, error: statusError } = await admin
      .from("services")
      .select("status");

    let statusCounts: Record<string, number> = {};
    if (!statusError && allServices) {
      allServices.forEach((s: { status: string }) => {
        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      });
    }

    if (statusError) {
      console.error("[admin/services/queue] Error fetching status counts:", statusError);
    }

    // Get accurate counts using count queries
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
    const supabaseUrl = diagnostics.supabaseUrl;
    const urlPreview = supabaseUrl.length > 50 ? `${supabaseUrl.substring(0, 50)}...` : supabaseUrl;
    
    console.log(
      `[admin/services/queue] Admin ${user.id} (${user.email}) fetched queue. ` +
      `Pending from query: ${normalizedServices.length}, ` +
      `Pending from count: ${pendingCount ?? 0}, ` +
      `Total: ${totalCount ?? 0}, ` +
      `Draft: ${draftCount ?? 0}, ` +
      `Approved: ${approvedCount ?? 0}, ` +
      `Rejected: ${rejectedCount ?? 0}, ` +
      `URL: ${urlPreview}, ` +
      `Service Role Key: ${diagnostics.serviceRoleKeyPresent ? 'present' : 'MISSING'}`
    );
    
    // If there's a mismatch between query and count, log a warning
    if (normalizedServices.length !== (pendingCount ?? 0)) {
      console.warn(
        `[admin/services/queue] WARNING: Query returned ${normalizedServices.length} pending services, ` +
        `but count query returned ${pendingCount ?? 0}. This may indicate a data inconsistency.`
      );
    }
    
    // If total is 0 but we expect services, log a warning
    if ((totalCount ?? 0) === 0) {
      console.warn(
        `[admin/services/queue] WARNING: Total services count is 0. ` +
        `This may indicate the query is hitting a different Supabase project. ` +
        `URL used: ${urlPreview}`
      );
    }

    return NextResponse.json(
      {
        pending: normalizedServices,
        counts: {
          total: totalCount || 0,
          draft: draftCount || 0,
          pending_review: pendingCount || 0,
          approved: approvedCount || 0,
          rejected: rejectedCount || 0,
        },
        diagnostics: {
          supabaseUrlUsed: diagnostics.supabaseUrl,
          serviceRoleKeyPresent: diagnostics.serviceRoleKeyPresent,
          serviceRoleKeyType: diagnostics.serviceRoleKeyType,
          chosenKeyName: null, // Explicitly indicate no key was found when query fails due to missing key
        },
        sanityCheck: {
          statusCountsFromGroupBy: statusCounts,
          pendingFromQuery: normalizedServices.length,
          pendingFromCount: pendingCount || 0,
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
    console.error("[admin/services/queue] Error:", error);
    const diagnostics = getAdminClientDiagnostics();
    return NextResponse.json(
      {
        error: "Internal server error",
        message: errorMessage,
        diagnostics,
        pending: [],
        counts: {
          total: 0,
          draft: 0,
          pending_review: 0,
          approved: 0,
          rejected: 0,
        },
        sanityCheck: {
          statusCountsFromGroupBy: {},
          pendingFromQuery: 0,
          pendingFromCount: 0,
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
