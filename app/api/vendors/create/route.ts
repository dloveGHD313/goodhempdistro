import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getIntoxicatingCutoffDate } from "@/lib/compliance";
import { randomUUID } from "crypto";

const BUILD_MARKER = "vendors-create-debug-v3";

/**
 * Helper to check if Supabase auth cookies are present in request
 */
function hasAuthCookies(req: NextRequest): boolean {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return false;
  
  // Check for common Supabase auth cookie patterns
  const supabaseCookiePatterns = [
    /sb-[^-]+-auth-token/,
    /sb-[^-]+-auth-token\.code-verifier/,
  ];
  
  return supabaseCookiePatterns.some(pattern => pattern.test(cookieHeader));
}

/**
 * Helper to determine debug status and reason
 */
function getDebugStatus(
  debugParam: boolean,
  debugKeyEnv: string | undefined,
  debugKeyHeader: string | null
): { enabled: boolean; reason: string } {
  if (!debugParam) {
    return { enabled: false, reason: "missing_debug_param" };
  }
  if (!debugKeyEnv) {
    return { enabled: false, reason: "missing_env_key" };
  }
  if (!debugKeyHeader) {
    return { enabled: false, reason: "missing_header_key" };
  }
  if (debugKeyHeader !== debugKeyEnv) {
    return { enabled: false, reason: "header_key_mismatch" };
  }
  return { enabled: true, reason: "enabled" };
}

/**
 * Create a new vendor application
 * Server-only route - requires authentication
 */
export async function POST(req: NextRequest) {
  // Generate unique request ID for tracking
  const requestId = randomUUID();
  
  try {
    // Production-safe debug gating
    const url = new URL(req.url);
    const debugParam = url.searchParams.get("debug") === "1";
    const debugKeyEnv = process.env.DEBUG_KEY;
    const debugKeyHeader = req.headers.get("x-debug-key");
    
    const debugStatus = getDebugStatus(debugParam, debugKeyEnv, debugKeyHeader);
    const debugEnabled = debugStatus.enabled;
    
    // Check for auth cookies in request
    const cookiePresent = hasAuthCookies(req);
    
    // Create session-aware Supabase client that reads cookies
    // Note: createSupabaseServerClient already handles cookies properly via @supabase/ssr
    const supabase = await createSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Build debug info if enabled
    let debugInfo: Record<string, any> = {};
    if (debugEnabled) {
      debugInfo = {
        has_user: !!user,
        user_id: user?.id || null,
        auth_error: userError ? {
          message: userError.message,
          status: userError.status,
        } : null,
        cookie_present: cookiePresent,
        server_timestamp: new Date().toISOString(),
      };
    }
    
    // Always log auth errors with request_id
    if (userError || !user) {
      console.error("[vendors/create] Auth error:", {
        request_id: requestId,
        error: userError?.message,
        code: userError?.status,
        hasUser: !!user,
        cookiePresent,
        userError: userError ? {
          message: userError.message,
          status: userError.status,
        } : null,
      });
      
      return NextResponse.json(
        { 
          error: "Unauthorized - Please log in to submit a vendor application",
          build_marker: BUILD_MARKER,
          request_id: requestId,
          debug_status: debugStatus,
          ...(debugEnabled ? { debug: debugInfo } : {}),
        },
        { status: 401 }
      );
    }

    // Parse JSON body safely
    let body: {
      business_name?: string;
      description?: string;
      coa_attested?: boolean;
      intoxicating_policy_ack?: boolean;
    };
    
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("[vendors/create] JSON parse error:", {
        request_id: requestId,
        error: parseError,
      });
      return NextResponse.json(
        {
          error: "Invalid request body",
          build_marker: BUILD_MARKER,
          request_id: requestId,
          debug_status: debugStatus,
          ...(debugEnabled ? { debug: { ...debugInfo, parseError: parseError instanceof Error ? parseError.message : "Unknown" } } : {}),
        },
        { status: 400 }
      );
    }

    const { business_name, description, coa_attested, intoxicating_policy_ack } = body;
    
    // Update debug info with payload lengths (not full text)
    if (debugEnabled) {
      debugInfo.business_name_length = business_name?.length || 0;
      debugInfo.description_length = description?.length || 0;
    }

    // Validate required fields
    if (!business_name || !business_name.trim()) {
      return NextResponse.json(
        { 
          error: "Business name is required",
          build_marker: BUILD_MARKER,
          request_id: requestId,
          debug_status: debugStatus,
          ...(debugEnabled ? { debug: debugInfo } : {}),
        },
        { status: 400 }
      );
    }

    // Require compliance attestations
    if (!coa_attested) {
      return NextResponse.json(
        { 
          error: "COA attestation is required",
          build_marker: BUILD_MARKER,
          request_id: requestId,
          debug_status: debugStatus,
          ...(debugEnabled ? { debug: debugInfo } : {}),
        },
        { status: 400 }
      );
    }

    if (!intoxicating_policy_ack) {
      return NextResponse.json(
        { 
          error: `Intoxicating products policy acknowledgement is required. Intoxicating products are allowed only until ${getIntoxicatingCutoffDate()}.`,
          build_marker: BUILD_MARKER,
          request_id: requestId,
          debug_status: debugStatus,
          ...(debugEnabled ? { debug: debugInfo } : {}),
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
          build_marker: BUILD_MARKER,
          request_id: requestId,
          debug_status: debugStatus,
          ...(debugEnabled ? { debug: debugInfo } : {}),
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
        request_id: requestId,
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
        build_marker: BUILD_MARKER,
        request_id: requestId,
        debug_status: debugStatus,
        ...(debugEnabled ? { debug: debugInfo } : {}),
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
      // ALWAYS log full Supabase error object with request_id
      console.error("[vendors/create] Error creating vendor application:", {
        request_id: requestId,
        error: applicationError,
        code: applicationError.code,
        message: applicationError.message,
        details: applicationError.details,
        hint: applicationError.hint,
        userId: user.id,
        cookiePresent,
      });
      
      // Build error response
      const errorResponse: Record<string, any> = {
        error: "Failed to submit vendor application. Please try again or contact support.",
        build_marker: BUILD_MARKER,
        request_id: requestId,
        debug_status: debugStatus,
      };

      // Add detailed error info if debug enabled
      if (debugEnabled) {
        errorResponse.debug = {
          ...debugInfo,
          supabase_error: {
            code: applicationError.code,
            message: applicationError.message,
            details: applicationError.details,
            hint: applicationError.hint,
          },
        };
      }
      
      return NextResponse.json(errorResponse, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      application: application,
      message: "Vendor application submitted. You will be notified once it's reviewed.",
      build_marker: BUILD_MARKER,
      request_id: requestId,
      debug_status: debugStatus,
      ...(debugEnabled ? { debug: debugInfo } : {}),
    }, { status: 201 });
  } catch (error) {
    // Catch any unexpected errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Try to get debug status if available (may fail if error is early)
    let catchDebugStatus = { enabled: false, reason: "error_in_debug_gating" };
    let catchDebugInfo: Record<string, any> = {};
    
    try {
      const url = new URL(req.url);
      const debugParam = url.searchParams.get("debug") === "1";
      const debugKeyEnv = process.env.DEBUG_KEY;
      const debugKeyHeader = req.headers.get("x-debug-key");
      catchDebugStatus = getDebugStatus(debugParam, debugKeyEnv, debugKeyHeader);
      
      if (catchDebugStatus.enabled) {
        catchDebugInfo = {
          unexpected_error: {
            message: errorMessage,
            stack: errorStack,
          },
        };
      }
    } catch {
      // If we can't determine debug status, use default
    }
    
    // ALWAYS log full error with request_id
    console.error("[vendors/create] Unexpected error:", {
      request_id: requestId,
      error,
      message: errorMessage,
      stack: errorStack,
    });
    
    return NextResponse.json(
      { 
        error: "An unexpected error occurred. Please try again later.",
        build_marker: BUILD_MARKER,
        request_id: requestId,
        debug_status: catchDebugStatus,
        ...(catchDebugStatus.enabled && Object.keys(catchDebugInfo).length > 0 ? { 
          debug: catchDebugInfo,
        } : {}),
      },
      { status: 500 }
    );
  }
}
