import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  getAdminDiagnostics,
  getSupabaseAdminClientOrThrow,
  type AdminDiagnostics,
} from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Build tag to verify deployed code version
const BUILD_TAG = "approve-no-joins-2026-01-20-p4z2n";

type ApproveResponse = {
  ok: boolean;
  diagnostics: AdminDiagnostics & {
    queryName?: string;
    buildTag?: string;
  };
  data?: {
    service?: any;
  };
  // legacy field used by existing client code
  success?: boolean;
  error?: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
    queryContext?: string;
  };
};

function createErrorResponse(params: {
  diagnostics: AdminDiagnostics;
  queryContext: string;
  status: number;
  message: string;
  supabaseError?: any;
}): NextResponse<ApproveResponse> {
  const { diagnostics, queryContext, status, message, supabaseError } = params;

  const urlPreview = diagnostics.supabaseUrlUsed?.substring(0, 50) || "NOT_SET";
  console.error(
    `[admin/services/approve] Query failed: ${queryContext} ` +
      `code=${supabaseError?.code || "unknown"} ` +
      `url=${urlPreview}... ` +
      `keyType=${diagnostics.keyType} ` +
      `keySource=${diagnostics.keySourceName || "none"} ` +
      `buildTag=${BUILD_TAG}`
  );

  return NextResponse.json<ApproveResponse>(
    {
      ok: false,
      diagnostics: {
        ...diagnostics,
        queryName: queryContext,
        buildTag: BUILD_TAG,
      },
      error: {
        message,
        code: supabaseError?.code || undefined,
        details: supabaseError?.details || undefined,
        hint: supabaseError?.hint || undefined,
        status,
        queryContext,
      },
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

/**
 * Approve service (admin only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const diagnostics = getAdminDiagnostics();

    const supabase = await createSupabaseServerClient();
    const { user, profile } = await getCurrentUserProfile(supabase);

    if (!user) {
      return createErrorResponse({
        diagnostics,
        queryContext: "auth_check",
        status: 401,
        message: "Unauthorized",
      });
    }

    if (!isAdmin(profile)) {
      return createErrorResponse({
        diagnostics,
        queryContext: "auth_check",
        status: 403,
        message: "Forbidden: Not an admin",
      });
    }

    const { id } = await params;
    
    let admin;
    try {
      admin = getSupabaseAdminClientOrThrow();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to initialize admin client";
      return createErrorResponse({
        diagnostics,
        queryContext: "admin_client_init",
        status: 500,
        message: errorMessage,
      });
    }

    // Get service
    const { data: service, error: serviceError } = await admin
      .from("services")
      .select("id, name, title, status")
      .eq("id", id)
      .maybeSingle();

    if (serviceError || !service) {
      return createErrorResponse({
        diagnostics,
        queryContext: "service_get",
        status: 404,
        message: "Service not found",
        supabaseError: serviceError || undefined,
      });
    }

    if (service.status !== 'pending_review') {
      return createErrorResponse({
        diagnostics,
        queryContext: "status_check",
        status: 400,
        message: `Service is not pending review (current status: ${service.status})`,
      });
    }

    // Update service to approved
    const { data: updatedService, error: updateError } = await admin
      .from("services")
      .update({
        status: 'approved',
        active: true, // Auto-activate on approval
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        rejection_reason: null, // Clear any previous rejection reason
      })
      .eq("id", id)
      .select("id, name, title, status")
      .single();

    if (updateError) {
      return createErrorResponse({
        diagnostics,
        queryContext: "service_update",
        status: 500,
        message: "Failed to approve service",
        supabaseError: updateError,
      });
    }

    // Get updated counts after approval
    const { count: pendingCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_review");

    const { count: approvedCount } = await admin
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    const urlPreview = diagnostics.supabaseUrlUsed?.substring(0, 50) || "NOT_SET";
    console.log(
      `[admin/services/approve] Approved ${id} (${service.name || service.title}) by admin ${user.id}. ` +
        `pending=${pendingCount ?? 0} approved=${approvedCount ?? 0} ` +
        `url=${urlPreview}... keyType=${diagnostics.keyType} keySource=${diagnostics.keySourceName || "none"} ` +
        `buildTag=${BUILD_TAG}`
    );

    // Revalidate paths
    revalidatePath("/admin/services");
    revalidatePath("/vendors/services");
    revalidatePath("/services"); // Public listing

    return NextResponse.json<ApproveResponse>(
      {
        ok: true,
        success: true,
        diagnostics: {
          ...diagnostics,
          queryName: "success",
          buildTag: BUILD_TAG,
        },
        data: {
          service: updatedService,
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    const diagnostics = getAdminDiagnostics();
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return createErrorResponse({
      diagnostics,
      queryContext: "unexpected_error",
      status: 500,
      message: errorMessage,
    });
  }
}
