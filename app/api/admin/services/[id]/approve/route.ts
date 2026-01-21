import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";

/**
 * Approve service (admin only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, profile } = await getCurrentUserProfile(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(profile)) {
      return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
    }

    const { id } = await params;
    
    let admin;
    try {
      admin = getSupabaseAdminClient();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to initialize admin client";
      console.error(`[admin/services/approve] ${errorMessage}`);
      return NextResponse.json(
        { error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing. Set it in Vercel Production environment variables and redeploy." },
        { status: 500 }
      );
    }

    // Get service
    const { data: service, error: serviceError } = await admin
      .from("services")
      .select("id, name, title, status")
      .eq("id", id)
      .maybeSingle();

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    if (service.status !== 'pending_review') {
      return NextResponse.json(
        { error: `Service is not pending review (current status: ${service.status})` },
        { status: 400 }
      );
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
      console.error(
        `[admin/services/approve] Error updating service ${id}:`,
        updateError,
        `SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "undefined"}, ` +
        `SERVICE_ROLE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY ? "present" : "missing"}`
      );
      return NextResponse.json(
        { error: "Failed to approve service" },
        { status: 500 }
      );
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

    console.log(
      `[admin/services/approve] Service ${id} (${service.name || service.title}) approved by admin ${user.id}. ` +
      `New status: approved, active: true. ` +
      `Updated counts: pending=${pendingCount ?? 0}, approved=${approvedCount ?? 0}. ` +
      `SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "undefined"}, ` +
      `SERVICE_ROLE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY ? "present" : "missing"}`
    );

    // Revalidate paths
    revalidatePath("/admin/services");
    revalidatePath("/vendors/services");
    revalidatePath("/services"); // Public listing

    return NextResponse.json({
      success: true,
      service: updatedService,
    });
  } catch (error) {
    console.error("[admin/services/approve] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
