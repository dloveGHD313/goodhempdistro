import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { validateProductCompliance } from "@/lib/compliance";

/**
 * Create a new product
 * Server-only route - requires vendor authentication
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log(`[vendor-products] SSR user check: ${user ? `found ${user.id} (${user.email})` : 'not found'}`);
    
    if (userError || !user) {
      console.error(`[vendor-products] Auth error:`, userError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get vendor for this user with error handling
    let { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, vendor_plan_id, status, owner_user_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    console.log(`[vendor-products] Vendor lookup for user ${user.id}: ${vendor ? `found ${vendor.id} (status: ${vendor.status})` : 'not found'}`);
    
    if (vendorError) {
      console.error(`[vendor-products] Vendor query error:`, vendorError);
      return NextResponse.json(
        { error: "Failed to verify vendor account" },
        { status: 500 }
      );
    }

    if (!vendor) {
      // VENDOR AUTO-PROVISIONING SAFETY NET
      // Check if user has an approved vendor application
      const { data: application } = await supabase
        .from("vendor_applications")
        .select("id, status, user_id, business_name, description")
        .eq("user_id", user.id)
        .maybeSingle();

      console.log(`[vendor-products] No vendor found. Application status: ${application ? application.status : 'none'}`);

      // If approved application exists but no vendor row, auto-create it
      if (application && application.status === 'approved') {
        console.warn(`[vendor-products] AUTO-PROVISION: Approved application exists but vendor row missing for user ${user.id} - creating vendor row`);
        
        try {
          const admin = getSupabaseAdminClient();
          
          // Auto-create vendor using service role (bypasses RLS)
          const { data: autoVendor, error: autoVendorError } = await admin
            .from("vendors")
            .upsert({
              owner_user_id: user.id,
              business_name: application.business_name || "Auto-provisioned Vendor",
              description: application.description || null,
              status: "active",
              is_active: true,
              is_approved: true,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: "owner_user_id",
            })
            .select("id, vendor_plan_id, status, owner_user_id")
            .single();

          if (autoVendorError || !autoVendor) {
            console.error(`[vendor-products] AUTO-PROVISION FAILED:`, autoVendorError);
            return NextResponse.json(
              { 
                error: "Vendor account provisioning failed. Please contact support.",
                autoProvisionAttempted: true,
              },
              { status: 500 }
            );
          }

          console.log(`[vendor-products] AUTO-PROVISION SUCCESS: Created vendor ${autoVendor.id} for user ${user.id}`);
          
          // Retry product creation with newly created vendor
          // Fall through to product creation logic below with autoVendor
          // Set vendor to autoVendor and continue
          vendor = autoVendor;
        } catch (autoProvisionError) {
          console.error(`[vendor-products] AUTO-PROVISION EXCEPTION:`, autoProvisionError);
          return NextResponse.json(
            { 
              error: "Vendor account provisioning error. Please contact support.",
              autoProvisionAttempted: true,
            },
            { status: 500 }
          );
        }
      } else {
        // No approved application - return friendly error
        return NextResponse.json(
          { 
            error: application?.status === 'pending' 
              ? "Your vendor application is pending approval. Please wait for admin approval before creating products."
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
      console.error(`[vendor-products] SECURITY: Vendor owner mismatch! user_id=${user.id}, vendor.owner_user_id=${vendor.owner_user_id}`);
      return NextResponse.json(
        { error: "Vendor account access denied" },
        { status: 403 }
      );
    }

    // Check subscription and product limits
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, plan_id, plan_type, status")
      .eq("user_id", user.id)
      .eq("plan_type", "vendor")
      .eq("status", "active")
      .single();

    if (subscription && subscription.plan_id) {
      // Get vendor plan details
      const { data: vendorPlan } = await supabase
        .from("vendor_plans")
        .select("product_limit")
        .eq("id", subscription.plan_id)
        .single();

      if (vendorPlan && vendorPlan.product_limit !== null) {
        // Count current products
        const { count } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("vendor_id", vendor.id);

        if ((count || 0) >= vendorPlan.product_limit) {
          return NextResponse.json(
            { error: `Product limit reached. Your plan allows ${vendorPlan.product_limit} products. Please upgrade your plan.` },
            { status: 403 }
          );
        }
      }
    } else {
      // No active subscription - check if there's a default limit
      // For now, allow product creation but could enforce subscription requirement
      console.warn(`⚠️ [product/create] Vendor ${vendor.id} has no active subscription`);
    }

    const { name, description, price_cents, category_id, active = true, product_type, coa_url, delta8_disclaimer_ack } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    if (!price_cents || price_cents < 0) {
      return NextResponse.json(
        { error: "Valid price is required" },
        { status: 400 }
      );
    }

    // Check if category requires COA
    let categoryRequiresCoa = false;
    if (category_id) {
      const { data: category } = await supabase
        .from("categories")
        .select("id, name, requires_coa, parent_id")
        .eq("id", category_id)
        .maybeSingle();

      if (category) {
        // Check category itself or parent category for requires_coa
        categoryRequiresCoa = category.requires_coa;
        
        // If parent exists, check parent too (parent's requires_coa applies to all children)
        if (category.parent_id && !categoryRequiresCoa) {
          const { data: parent } = await supabase
            .from("categories")
            .select("requires_coa")
            .eq("id", category.parent_id)
            .maybeSingle();
          
          if (parent?.requires_coa) {
            categoryRequiresCoa = true;
          }
        }
      }
    }

    console.log(`[vendor-products] Category COA requirement: category_id=${category_id}, requires_coa=${categoryRequiresCoa}`);

    // Validate compliance (COA only required if category requires it)
    const complianceErrors = validateProductCompliance({
      product_type: product_type || "non_intoxicating",
      coa_url,
      delta8_disclaimer_ack,
      category_requires_coa: categoryRequiresCoa,
    });

    if (complianceErrors.length > 0) {
      return NextResponse.json(
        { error: complianceErrors[0].message, complianceErrors },
        { status: 400 }
      );
    }

    // Create product with draft status (requires admin approval)
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        vendor_id: vendor.id,
        owner_user_id: user.id, // Direct reference for RLS
        name: name.trim(),
        description: description?.trim() || null,
        price_cents: parseInt(price_cents),
        category_id: category_id || null,
        status: 'draft', // Always start as draft
        active: false, // Not active until approved
        product_type: product_type || "non_intoxicating",
        coa_url: coa_url?.trim() || null,
        delta8_disclaimer_ack: delta8_disclaimer_ack === true,
      })
      .select("id, name, price_cents, status")
      .single();

    if (productError) {
      console.error(`[vendor-products] Error creating product:`, {
        message: productError.message,
        details: productError.details,
        hint: productError.hint,
        code: productError.code,
      });
      return NextResponse.json(
        {
          error: "Failed to create product",
          message: productError.message,
          details: productError.details,
          hint: productError.hint,
          code: productError.code,
        },
        { status: 500 }
      );
    }

    console.log(`[vendor-products] Product created: id=${product.id}, status=${product.status}`);

    return NextResponse.json({
      success: true,
      product: product,
      message: "Product created as draft. Submit for review to make it live.",
    }, { status: 201 });
  } catch (error) {
    console.error("Product creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
