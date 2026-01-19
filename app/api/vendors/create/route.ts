import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getIntoxicatingCutoffDate } from "@/lib/compliance";

/**
 * Create a new vendor application
 * Server-only route - requires authentication
 */
export async function POST(req: NextRequest) {
  try {
    // Create session-aware Supabase client that reads cookies
    const supabase = await createSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Debug info (dev only)
    const debugInfo: Record<string, any> = {};
    if (process.env.NODE_ENV !== "production") {
      debugInfo.debug_has_user = !!user;
      debugInfo.debug_user_id = user?.id || null;
      if (userError) {
        debugInfo.debug_auth_error = {
          message: userError.message,
          status: userError.status,
        };
      }
    }
    
    if (userError || !user) {
      console.error("[vendors/create] Auth error:", {
        error: userError?.message,
        code: userError?.status,
        hasUser: !!user,
      });
      
      return NextResponse.json(
        { 
          error: "Unauthorized - Please log in to submit a vendor application",
          ...debugInfo,
        },
        { status: 401 }
      );
    }

    const { business_name, description, coa_attested, intoxicating_policy_ack } = await req.json();

    // Validate required fields
    if (!business_name || !business_name.trim()) {
      return NextResponse.json(
        { 
          error: "Business name is required",
          ...debugInfo,
        },
        { status: 400 }
      );
    }

    // Require compliance attestations
    if (!coa_attested) {
      return NextResponse.json(
        { 
          error: "COA attestation is required",
          ...debugInfo,
        },
        { status: 400 }
      );
    }

    if (!intoxicating_policy_ack) {
      return NextResponse.json(
        { 
          error: `Intoxicating products policy acknowledgement is required. Intoxicating products are allowed only until ${getIntoxicatingCutoffDate()}.`,
          ...debugInfo,
        },
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
        { 
          error: "Vendor account already exists", 
          vendor_id: existingVendor.id,
          ...debugInfo,
        },
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
      console.error("[vendors/create] Error checking existing application:", {
        code: checkError.code,
        message: checkError.message,
        details: checkError.details,
        hint: checkError.hint,
        userId: user.id,
      });
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
        ...debugInfo,
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
      // Log detailed error information
      console.error("[vendors/create] Error creating vendor application:", {
        code: applicationError.code,
        message: applicationError.message,
        details: applicationError.details,
        hint: applicationError.hint,
        userId: user.id,
        businessName: business_name.trim(),
      });
      
      // Build error response with dev details
      const errorResponse: Record<string, any> = {
        error: process.env.NODE_ENV === "production"
          ? "Failed to submit vendor application. Please try again or contact support."
          : applicationError.message || "Failed to submit vendor application",
        ...debugInfo,
      };

      // Add detailed error info in development
      if (process.env.NODE_ENV !== "production") {
        errorResponse.code = applicationError.code;
        errorResponse.details = applicationError.details;
        errorResponse.hint = applicationError.hint;
        errorResponse.message = applicationError.message;
      }
      
      return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      application: application,
      message: "Vendor application submitted. You will be notified once it's reviewed.",
      ...debugInfo,
    }, { status: 201 });
  } catch (error) {
    // Catch any unexpected errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("[vendors/create] Unexpected error:", {
      message: errorMessage,
      stack: process.env.NODE_ENV !== "production" ? errorStack : undefined,
    });
    
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === "production"
          ? "An unexpected error occurred. Please try again later."
          : errorMessage,
      },
      { status: 500 }
    );
  }
}
