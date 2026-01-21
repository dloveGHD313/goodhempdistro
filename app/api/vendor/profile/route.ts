import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

/**
 * Update vendor profile (tier + vendor types)
 * Server-only route - requires vendor authentication
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get vendor
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, owner_user_id, tier, vendor_type, vendor_types")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (vendorError) {
      console.error(`[vendor/profile] Error fetching vendor:`, vendorError);
      return NextResponse.json(
        { error: "Failed to fetch vendor" },
        { status: 500 }
      );
    }

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor account not found" },
        { status: 404 }
      );
    }

    // DEFENSIVE: Verify vendor belongs to this user
    if (vendor.owner_user_id !== user.id) {
      console.error(`[vendor/profile] SECURITY: Vendor owner mismatch! user_id=${user.id}, vendor.owner_user_id=${vendor.owner_user_id}`);
      return NextResponse.json(
        { error: "Vendor account access denied" },
        { status: 403 }
      );
    }

    const { tier, vendor_type, vendor_types } = await req.json();

    // Validate tier
    if (tier && !['starter', 'mid', 'top'].includes(tier)) {
      return NextResponse.json(
        { error: "Invalid tier. Must be starter, mid, or top" },
        { status: 400 }
      );
    }

    // Enforce tier-based vendor type rules
    const currentTier = tier || vendor.tier || 'starter';
    
    if (currentTier === 'starter' || currentTier === 'mid') {
      // Must have exactly ONE vendor_type, no vendor_types array
      if (vendor_type && vendor_types && vendor_types.length > 0) {
        return NextResponse.json(
          { error: `Tier '${currentTier}' requires exactly one vendor type. Cannot use multiple types.` },
          { status: 400 }
        );
      }
      
      if (!vendor_type) {
        return NextResponse.json(
          { error: `Tier '${currentTier}' requires a vendor_type to be set` },
          { status: 400 }
        );
      }

      // Clear vendor_types array for starter/mid
      const { data: updatedVendor, error: updateError } = await supabase
        .from("vendors")
        .update({
          tier: currentTier,
          vendor_type,
          vendor_types: null, // Clear array
        })
        .eq("id", vendor.id)
        .select("id, tier, vendor_type, vendor_types")
        .single();

      if (updateError) {
        console.error(`[vendor/profile] Error updating vendor:`, updateError);
        return NextResponse.json(
          { error: "Failed to update vendor profile" },
          { status: 500 }
        );
      }

      console.log(`[vendor/profile] Vendor ${vendor.id} updated: tier=${currentTier}, vendor_type=${vendor_type}`);

      // Revalidate paths
      revalidatePath("/vendors/settings");
      revalidatePath("/vendors/dashboard");

      return NextResponse.json({
        success: true,
        vendor: updatedVendor,
      }, { status: 200 });
    } else if (currentTier === 'top') {
      // Top tier can have multiple vendor_types
      if (vendor_types && !Array.isArray(vendor_types)) {
        return NextResponse.json(
          { error: "vendor_types must be an array for top tier" },
          { status: 400 }
        );
      }

      if (!vendor_types || vendor_types.length === 0) {
        return NextResponse.json(
          { error: "Top tier requires at least one vendor type in vendor_types array" },
          { status: 400 }
        );
      }

      // Clear single vendor_type for top tier
      const { data: updatedVendor, error: updateError } = await supabase
        .from("vendors")
        .update({
          tier: currentTier,
          vendor_type: null, // Clear single type
          vendor_types, // Set array
        })
        .eq("id", vendor.id)
        .select("id, tier, vendor_type, vendor_types")
        .single();

      if (updateError) {
        console.error(`[vendor/profile] Error updating vendor:`, updateError);
        return NextResponse.json(
          { error: "Failed to update vendor profile" },
          { status: 500 }
        );
      }

      console.log(`[vendor/profile] Vendor ${vendor.id} updated: tier=${currentTier}, vendor_types=${vendor_types.join(',')}`);

      // Revalidate paths
      revalidatePath("/vendors/settings");
      revalidatePath("/vendors/dashboard");

      return NextResponse.json({
        success: true,
        vendor: updatedVendor,
      }, { status: 200 });
    }

    return NextResponse.json(
      { error: "Invalid tier" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[vendor/profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
