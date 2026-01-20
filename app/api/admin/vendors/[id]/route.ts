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

    // If approved, create vendor record and update profile role
    if (status === "approved") {
      console.log(`[admin/vendors] Approving application ${id} for user ${application.user_id}`);
      
      // Check if vendor already exists
      const { data: existingVendor, error: checkError } = await admin
        .from("vendors")
        .select("id, status, owner_user_id")
        .eq("owner_user_id", application.user_id)
        .maybeSingle();

      if (checkError) {
        console.error("[admin/vendors] Error checking existing vendor:", checkError);
      }

      // If vendor exists but status is 'pending', log warning and update to 'active'
      if (existingVendor) {
        if (existingVendor.status === 'pending') {
          console.warn(`[admin/vendors] Vendor row exists with status 'pending' for user ${application.user_id} - updating to 'active'`);
          const { error: updateVendorError } = await admin
            .from("vendors")
            .update({
              status: "active",
              business_name: application.business_name,
              description: application.description,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingVendor.id);

          if (updateVendorError) {
            console.error("[admin/vendors] Error updating vendor status:", updateVendorError);
            return NextResponse.json(
              { error: `Failed to update vendor: ${updateVendorError.message}` },
              { status: 500 }
            );
          }
          console.log(`[admin/vendors] Updated existing vendor ${existingVendor.id} to active status`);
        } else {
          console.log(`[admin/vendors] Vendor already exists with status ${existingVendor.status} - skipping creation`);
        }
      } else {
        // Create vendor record with status 'active' (vendors table should only have active vendors)
        const { data: newVendor, error: vendorError } = await admin
          .from("vendors")
          .insert({
            owner_user_id: application.user_id,
            business_name: application.business_name,
            description: application.description,
            status: "active", // Vendors table should only contain active vendors
          })
          .select("id")
          .single();

        if (vendorError) {
          console.error("[admin/vendors] Error creating vendor:", vendorError);
          return NextResponse.json(
            { error: `Failed to create vendor: ${vendorError.message}` },
            { status: 500 }
          );
        }
        console.log(`[admin/vendors] Created vendor record ${newVendor.id} for user ${application.user_id}`);
      }

      // Update profile role to vendor (if profile exists)
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          role: "vendor",
          updated_at: new Date().toISOString(),
        })
        .eq("id", application.user_id);

      if (profileError) {
        // Profile might not exist - log but don't fail (trigger should create it)
        console.warn(`[admin/vendors] Could not update profile role for user ${application.user_id}:`, profileError.message);
      } else {
        console.log(`[admin/vendors] Updated profile role to 'vendor' for user ${application.user_id}`);
      }
    } else if (status === "rejected") {
      // On reject, do NOT create vendors row
      // Only update application status
      console.log(`[admin/vendors] Rejecting application ${id} for user ${application.user_id}`);
      
      // Ensure no vendors row exists for this user (cleanup if somehow created)
      const { data: orphanedVendor } = await admin
        .from("vendors")
        .select("id, status")
        .eq("owner_user_id", application.user_id)
        .maybeSingle();

      if (orphanedVendor && orphanedVendor.status === 'pending') {
        console.warn(`[admin/vendors] Found orphaned pending vendor ${orphanedVendor.id} for rejected application - deleting`);
        await admin
          .from("vendors")
          .delete()
          .eq("id", orphanedVendor.id);
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
