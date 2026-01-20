import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";

/**
 * Approve or reject vendor application (admin only)
 */
export async function PUT(
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
    const { status } = await req.json();

    if (!status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    // Get application
    const { data: application, error: appError } = await admin
      .from("vendor_applications")
      .select("id, user_id, business_name, description, status")
      .eq("id", id)
      .single();

    if (appError || !application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // If approved, create vendor record and update profile role FIRST
    if (status === "approved") {
      // Check if vendor already exists
      const { data: existingVendor } = await admin
        .from("vendors")
        .select("id")
        .eq("owner_user_id", application.user_id)
        .maybeSingle();

      if (!existingVendor) {
        // Create vendor record
        const { error: vendorError } = await admin
          .from("vendors")
          .insert({
            owner_user_id: application.user_id,
            business_name: application.business_name,
            description: application.description,
            status: "active",
          });

        if (vendorError) {
          console.error("Error creating vendor:", vendorError);
          return NextResponse.json(
            { error: `Failed to create vendor: ${vendorError.message}` },
            { status: 500 }
          );
        }
      }

      // Update profile role to vendor
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          role: "vendor",
          updated_at: new Date().toISOString(),
        })
        .eq("id", application.user_id);

      if (profileError) {
        console.error("Error updating profile role:", profileError);
        // Don't fail, but log it
      }
    }

    // Update application status
    const { data: updatedApplication, error: updateError } = await admin
      .from("vendor_applications")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, user_id, business_name, description, status, created_at, updated_at")
      .single();

    if (updateError) {
      console.error("Error updating vendor application:", updateError);
      return NextResponse.json(
        { error: "Failed to update application status" },
        { status: 500 }
      );
    }

    // Revalidate relevant paths so vendor sees updated status immediately
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/vendor-registration");
    revalidatePath("/vendors/dashboard");
    revalidatePath("/admin/vendors");

    return NextResponse.json({ 
      success: true,
      application: updatedApplication,
    });
  } catch (error) {
    console.error("Admin vendor approval error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
