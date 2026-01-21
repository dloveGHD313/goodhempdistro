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

    // If approved, upsert vendor record and update profile role
    if (status === "approved") {
      console.log(`[admin/vendors] Approving application ${id} for user ${application.user_id}`);
      
      // UPSERT vendor record using ON CONFLICT (guaranteed vendor creation)
      const { data: vendor, error: vendorError } = await admin
        .from("vendors")
        .upsert({
          owner_user_id: application.user_id,
          business_name: application.business_name,
          description: application.description,
          status: "active",
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "owner_user_id",
        })
        .select("id, status")
        .single();

      if (vendorError) {
        console.error(`[admin/vendors] Error upserting vendor:`, vendorError);
        return NextResponse.json(
          { error: `Failed to create/update vendor: ${vendorError.message}` },
          { status: 500 }
        );
      }

      console.log(`[admin/vendors] Vendor ${vendor.id} created or reused for user ${application.user_id} (status: ${vendor.status})`);

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
