import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * Create a new service
 * Server-only route - requires vendor authentication
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log(`[vendor-services] SSR user check: ${user ? `found ${user.id} (${user.email})` : 'not found'}`);
    
    if (userError || !user) {
      console.error(`[vendor-services] Auth error:`, userError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get vendor with auto-provisioning safety net (same as products)
    let { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, owner_user_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (vendorError) {
      console.error(`[vendor-services] Vendor query error (user client):`, vendorError);
      const admin = getSupabaseAdminClient();
      const { data: adminVendor, error: adminVendorError } = await admin
        .from("vendors")
        .select("id, owner_user_id")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (adminVendorError) {
        console.error(`[vendor-services] Vendor query error (admin client):`, adminVendorError);
      } else {
        vendor = adminVendor;
        vendorError = null;
      }
    }

    console.log(`[vendor-services] Vendor lookup for user ${user.id}: ${vendor ? `found ${vendor.id}` : 'not found'}`);
    
    if (vendorError) {
      return NextResponse.json(
        { error: "Failed to verify vendor account" },
        { status: 500 }
      );
    }

    if (!vendor) {
      // VENDOR AUTO-PROVISIONING SAFETY NET
      const { data: application } = await supabase
        .from("vendor_applications")
        .select("id, status, user_id, business_name, description")
        .eq("user_id", user.id)
        .maybeSingle();

      console.log(`[vendor-services] No vendor found. Application status: ${application ? application.status : 'none'}`);

      if (application && application.status === 'approved') {
        console.warn(`[vendor-services] AUTO-PROVISION: Approved application exists but vendor row missing for user ${user.id} - creating vendor row`);
        
        try {
          const admin = getSupabaseAdminClient();
          
          const { data: autoVendor, error: autoVendorError } = await admin
            .from("vendors")
            .upsert({
              owner_user_id: user.id,
              business_name: application.business_name || "Auto-provisioned Vendor",
              description: application.description || null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: "owner_user_id",
            })
            .select("id, owner_user_id")
            .single();

          if (autoVendorError || !autoVendor) {
            console.error(`[vendor-services] AUTO-PROVISION FAILED:`, autoVendorError);
            return NextResponse.json(
              { 
                error: "Vendor account provisioning failed. Please contact support.",
                autoProvisionAttempted: true,
              },
              { status: 500 }
            );
          }

          console.log(`[vendor-services] AUTO-PROVISION SUCCESS: Created vendor ${autoVendor.id} for user ${user.id}`);
          vendor = autoVendor;
        } catch (autoProvisionError) {
          console.error(`[vendor-services] AUTO-PROVISION EXCEPTION:`, autoProvisionError);
          return NextResponse.json(
            { 
              error: "Vendor account provisioning error. Please contact support.",
              autoProvisionAttempted: true,
            },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { 
            error: application?.status === 'pending' 
              ? "Your vendor application is pending approval. Please wait for admin approval before creating services."
              : application?.status === 'rejected'
              ? "Your vendor application was rejected. Please contact support if you believe this is an error."
              : "Vendor account required. Please apply to become a vendor first.",
            hasApplication: !!application,
            applicationStatus: application?.status || null,
          },
          { status: 404 }
        );
      }
    }

    // DEFENSIVE: Verify vendor belongs to this user
    if (vendor.owner_user_id !== user.id) {
      console.error(`[vendor-services] SECURITY: Vendor owner mismatch! user_id=${user.id}, vendor.owner_user_id=${vendor.owner_user_id}`);
      return NextResponse.json(
        { error: "Vendor account access denied" },
        { status: 403 }
      );
    }

    const { 
      name, 
      title, 
      description, 
      category_id, 
      subcategory_id, 
      pricing_type,
      price_cents,
      slug,
      coa_object_path
    } = await req.json();

    // Use name if provided, otherwise use title
    const serviceName = (name?.trim() || title?.trim());
    if (!serviceName) {
      return NextResponse.json(
        { error: "Service name or title is required" },
        { status: 400 }
      );
    }

    // Verify category is a service category
    if (category_id) {
      const { data: category } = await supabase
        .from("categories")
        .select("id, category_type")
        .eq("id", category_id)
        .maybeSingle();

      if (category && category.category_type !== 'service') {
        return NextResponse.json(
          { error: "Category must be a service category" },
          { status: 400 }
        );
      }
    }

    // Validate pricing
    if (pricing_type && !['flat_fee', 'hourly', 'per_project', 'quote_only'].includes(pricing_type)) {
      return NextResponse.json(
        { error: "Invalid pricing_type. Must be flat_fee, hourly, per_project, or quote_only" },
        { status: 400 }
      );
    }

    // Price is required if not quote_only
    if (pricing_type && pricing_type !== 'quote_only' && (!price_cents || price_cents < 0)) {
      return NextResponse.json(
        { error: "Price is required for this pricing type" },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    const serviceSlug = slug?.trim() || 
      serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    // Create service with draft status
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .insert({
        vendor_id: vendor.id,
        owner_user_id: user.id,
        name: name?.trim() || null,
        title: title?.trim() || serviceName,
        description: description?.trim() || null,
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        pricing_type: pricing_type || null,
        price_cents: price_cents ? parseInt(price_cents) : null,
        slug: serviceSlug,
        coa_object_path: coa_object_path?.trim() || null,
        status: 'draft',
        active: false,
      })
      .select("id, name, title, status, slug")
      .single();

    if (serviceError) {
      console.error(`[vendor-services] Error creating service:`, {
        message: serviceError.message,
        details: serviceError.details,
        hint: serviceError.hint,
        code: serviceError.code,
      });
      const includeDetails = process.env.NODE_ENV !== "production";
      return NextResponse.json(
        { 
          error: "Failed to create service",
          message: includeDetails ? serviceError.message : undefined,
          details: includeDetails ? serviceError.details : undefined,
          hint: includeDetails ? serviceError.hint : undefined,
          code: includeDetails ? serviceError.code : undefined,
        },
        { status: 500 }
      );
    }

    console.log(`[vendor-services] Service created: id=${service.id}, status=${service.status}`);

    return NextResponse.json({
      success: true,
      service: service,
      message: "Service created as draft. Submit for review to make it live.",
    }, { status: 201 });
  } catch (error) {
    console.error("[vendor-services] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
