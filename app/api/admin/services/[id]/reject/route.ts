import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";

/**
 * Reject service (admin only)
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
    const { reason } = await req.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();

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

    // Update service to rejected
    const { data: updatedService, error: updateError } = await admin
      .from("services")
      .update({
        status: 'rejected',
        active: false, // Ensure inactive
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        rejection_reason: reason.trim(),
      })
      .eq("id", id)
      .select("id, name, title, status, rejection_reason")
      .single();

    if (updateError) {
      console.error("[admin/services/reject] Error updating service:", updateError);
      return NextResponse.json(
        { error: "Failed to reject service" },
        { status: 500 }
      );
    }

    console.log(`[admin/services/reject] Service ${id} rejected by admin ${user.id}: ${reason.substring(0, 50)}...`);

    // Revalidate paths
    revalidatePath("/admin/services");
    revalidatePath("/vendors/services");

    return NextResponse.json({
      success: true,
      service: updatedService,
    });
  } catch (error) {
    console.error("[admin/services/reject] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
