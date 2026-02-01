import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/**
 * Approve or reject vendor application (admin only)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
    }

    const { id } = await params;
    const { status } = await req.json();

    if (!status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    // Get application (include referral_code for vendor referral attribution)
    const { data: application, error: appError } = await admin
      .from("vendor_applications")
      .select("id, user_id, business_name, description, status, referral_code")
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
          is_active: true,
          is_approved: true,
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

      // Vendor referral: if application had referral_code, create signup referral + ledger
      const referralCode = application.referral_code && /^[A-Za-z0-9\-]+$/.test(String(application.referral_code).trim())
        ? String(application.referral_code).trim()
        : null;
      if (referralCode) {
        const { data: referrer } = await admin
          .from("vendor_referrers")
          .select("id, vendor_id")
          .eq("referral_code", referralCode)
          .maybeSingle();
        if (referrer && referrer.vendor_id !== vendor.id) {
          const { data: rule } = await admin
            .from("vendor_referral_reward_rules")
            .select("reward_cents")
            .eq("event_type", "signup")
            .eq("active", true)
            .maybeSingle();
          const rewardCents = rule?.reward_cents ?? 1000;
          const { data: referral } = await admin
            .from("vendor_referrals")
            .insert({
              referrer_vendor_id: referrer.vendor_id,
              referred_vendor_id: vendor.id,
              event_type: "signup",
              order_id: null,
              reward_cents: rewardCents,
              status: "pending",
            })
            .select("id")
            .single();
          if (referral) {
            await admin.from("vendor_referral_ledger").insert({
              referrer_vendor_id: referrer.vendor_id,
              amount_cents: rewardCents,
              status: "available",
              vendor_referral_id: referral.id,
              order_id: null,
              metadata: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            console.log(`[admin/vendors] Vendor referral signup created | referrer=${referrer.vendor_id} referred=${vendor.id} reward=${rewardCents}¢`);
          }
        }
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
