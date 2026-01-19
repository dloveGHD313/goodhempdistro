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

    // Check if vendor application already exists
    const { data: existingApplication, error: checkError } = await supabase
      .from("vendor_applications")
      .select("id, status, business_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing application:", checkError);
      // Continue to try insert anyway
    }

    if (existingApplication) {
      // Return existing application instead of failing
      return NextResponse.json({
        success: true,
        application: {
          id: existingApplication.id,
          status: existingApplication.status,
        },
        message: existingApplication.status === "pending"
          ? "Vendor application already submitted and pending review."
          : existingApplication.status === "approved"
          ? "Vendor application was already approved."
          : "Vendor application was previously rejected.",
      }, { status: 200 });
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
      
      // Return real Postgres error message in development
      const errorMessage = process.env.NODE_ENV === "development"
        ? applicationError.message || applicationError.details || "Failed to submit vendor application"
        : "Failed to submit vendor application";
      
      return NextResponse.json(
        { 
          error: errorMessage,
          code: applicationError.code,
          details: process.env.NODE_ENV === "development" ? applicationError.details : undefined,
        },
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
