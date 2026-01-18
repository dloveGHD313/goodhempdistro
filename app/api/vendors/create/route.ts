import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getIntoxicatingCutoffDate } from "@/lib/compliance";

/**
 * Create a new vendor record
 * Server-only route - requires authentication
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { business_name, description, coa_attested, intoxicating_policy_ack } = await req.json();

    if (!business_name || !business_name.trim()) {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    // Require compliance attestations
    if (!coa_attested) {
      return NextResponse.json(
        { error: "COA attestation is required" },
        { status: 400 }
      );
    }

    if (!intoxicating_policy_ack) {
      return NextResponse.json(
        { error: `Intoxicating products policy acknowledgement is required. Intoxicating products are allowed only until ${getIntoxicatingCutoffDate()}.` },
        { status: 400 }
      );
    }

    // Check if vendor already exists for this user
    const { data: existingVendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (existingVendor) {
      return NextResponse.json(
        { error: "Vendor already exists for this user", vendor_id: existingVendor.id },
        { status: 409 }
      );
    }

    // Create vendor
    const now = new Date().toISOString();
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .insert({
        owner_user_id: user.id,
        business_name: business_name.trim(),
        description: description?.trim() || null,
        status: "pending",
        coa_attested: true,
        coa_attested_at: now,
        intoxicating_policy_ack: true,
        intoxicating_policy_ack_at: now,
      })
      .select("id, business_name, status")
      .single();

    if (vendorError) {
      console.error("Error creating vendor:", vendorError);
      return NextResponse.json(
        { error: "Failed to create vendor" },
        { status: 500 }
      );
    }

    // Update user profile to vendor role
    await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        role: "vendor",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    return NextResponse.json({
      success: true,
      vendor: vendor,
    }, { status: 201 });
  } catch (error) {
    console.error("Vendor creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
