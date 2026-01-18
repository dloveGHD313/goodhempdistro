import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Create a new product
 * Server-only route - requires vendor authentication
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get vendor for this user
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, vendor_plan_id")
      .eq("owner_user_id", user.id)
      .single();

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor account not found" },
        { status: 404 }
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

    const { name, description, price_cents, category_id, active = true } = await req.json();

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

    // Create product
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        vendor_id: vendor.id,
        name: name.trim(),
        description: description?.trim() || null,
        price_cents: parseInt(price_cents),
        category_id: category_id || null,
        active: active === true,
      })
      .select("id, name, price_cents")
      .single();

    if (productError) {
      console.error("Error creating product:", productError);
      return NextResponse.json(
        { error: "Failed to create product" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      product: product,
    }, { status: 201 });
  } catch (error) {
    console.error("Product creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
