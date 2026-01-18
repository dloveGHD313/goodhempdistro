import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * Admin-only driver management API
 * PUT: Update driver application status (approve/reject)
 */

async function checkAdminAccess() {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return { authorized: false, error: "Forbidden - Admin access required", status: 403 };
  }

  return { authorized: true, user };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const check = await checkAdminAccess();
    if (!check.authorized) {
      return NextResponse.json(
        { error: check.error },
        { status: check.status || 403 }
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
