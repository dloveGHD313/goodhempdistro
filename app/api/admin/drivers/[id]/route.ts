import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/**
 * Admin-only driver management API
 * PUT: Update driver application status (approve/reject)
 */

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { status } = await req.json();

    if (!status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();

    // Get application details
    const { data: application, error: appError } = await admin
      .from("driver_applications")
      .select("user_id, status")
      .eq("id", id)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Update application status
    const { error: updateError } = await admin
      .from("driver_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating application:", updateError);
      return NextResponse.json(
        { error: "Failed to update application" },
        { status: 500 }
      );
    }

    // If approved, create driver record
    if (status === "approved") {
      const { error: driverError } = await admin
        .from("drivers")
        .upsert({
          user_id: application.user_id,
          status: "approved",
        }, {
          onConflict: "user_id",
        });

      if (driverError) {
        console.error("Error creating driver:", driverError);
        // Don't fail the request if driver already exists
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Driver PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
