import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/**
 * Fix missing vendor rows for approved applications (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();

    // Get all approved applications
    const { data: approvedApplications, error: appsError } = await admin
      .from("vendor_applications")
      .select("id, user_id, business_name, description, status")
      .eq("status", "approved");

    if (appsError) {
      console.error("[admin/vendors/integrity/fix] Error fetching applications:", appsError);
      return NextResponse.json(
        { error: "Failed to fetch applications" },
        { status: 500 }
      );
    }

    if (!approvedApplications || approvedApplications.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        message: "No approved applications found",
      });
    }

    let created = 0;
    const errors: string[] = [];

    // For each approved application, ensure vendor row exists
    for (const app of approvedApplications) {
      // Check if vendor exists
      const { data: existingVendor } = await admin
        .from("vendors")
        .select("id")
        .eq("owner_user_id", app.user_id)
        .maybeSingle();

      if (!existingVendor) {
        // Create vendor row using UPSERT (idempotent)
        const { data: vendor, error: vendorError } = await admin
          .from("vendors")
          .upsert({
            owner_user_id: app.user_id,
            business_name: app.business_name || "Auto-provisioned Vendor",
            description: app.description || null,
            status: "active",
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "owner_user_id",
          })
          .select("id")
          .single();

        if (vendorError) {
          console.error(`[admin/vendors/integrity/fix] Failed to create vendor for user ${app.user_id}:`, vendorError);
          errors.push(`User ${app.user_id}: ${vendorError.message}`);
        } else {
          console.log(`[admin/vendors/integrity/fix] Created vendor ${vendor.id} for user ${app.user_id}`);
          created++;
        }
      }
    }

    console.log(
      `[admin/vendors/integrity/fix] Admin ${adminCheck.user.id} fixed vendor integrity. Created: ${created}, Errors: ${errors.length}`
    );

    if (errors.length > 0) {
      return NextResponse.json({
        success: true,
        created,
        errors,
        message: `Created ${created} vendor row(s), but ${errors.length} error(s) occurred`,
      });
    }

    return NextResponse.json({
      success: true,
      created,
      message: `Successfully created ${created} vendor row(s)`,
    });
  } catch (error) {
    console.error("[admin/vendors/integrity/fix] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
