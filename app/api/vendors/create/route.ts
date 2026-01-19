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

    // Check if vendor application already exists
    const { data: existingApplication } = await supabase
      .from("vendor_applications")
      .select("id, status")
      .eq("user_id", user.id)
      .single();

    if (existingApplication) {
      return NextResponse.json(
        { 
          error: "Vendor application already exists", 
          application_id: existingApplication.id,
          status: existingApplication.status,
        },
        { status: 409 }
      );
    }

    // Check if vendor already exists (approved)
    const { data: existingVendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (existingVendor) {
      return NextResponse.json(
        { error: "Vendor account already exists", vendor_id: existingVendor.id },
        { status: 409 }
      );
    }

    // Create vendor application
    const { data: application, error: applicationError } = await supabase
      .from("vendor_applications")
      .insert({
        user_id: user.id,
        business_name: business_name.trim(),
        description: description?.trim() || null,
        status: "pending",
      })
      .select("id, status")
      .single();

    if (applicationError) {
      console.error("Error creating vendor application:", applicationError);
      return NextResponse.json(
        { error: "Failed to submit vendor application" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      application: application,
      message: "Vendor application submitted. You will be notified once it's reviewed.",
    }, { status: 201 });
  } catch (error) {
    console.error("Vendor creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
