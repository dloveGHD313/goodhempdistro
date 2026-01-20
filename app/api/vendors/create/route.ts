import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getIntoxicatingCutoffDate } from "@/lib/compliance";
import { randomUUID } from "crypto";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
 * Helper to create a standardized error response with headers
 */
function createErrorResponse(
  error: string,
  status: number,
  requestId: string,
  debugStatus: { enabled: boolean; reason: string },
  debugInfo?: Record<string, any>
): NextResponse {
  const response: Record<string, any> = {
    error,
    build_marker: BUILD_MARKER,
    request_id: requestId,
    debug_status: debugStatus,
  };

  if (debugInfo && debugStatus.enabled) {
    response.debug = debugInfo;
  }

  return NextResponse.json(response, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Build-Marker': BUILD_MARKER,
      'X-Request-Id': requestId,
    },
  });
}

/**
 * Helper to create a standardized success response with headers
 */
function createSuccessResponse(
  data: Record<string, any>,
  status: number,
  requestId: string,
  debugStatus: { enabled: boolean; reason: string },
  debugInfo?: Record<string, any>
): NextResponse {
  const response: Record<string, any> = {
    ...data,
    build_marker: BUILD_MARKER,
    request_id: requestId,
    debug_status: debugStatus,
  };

  if (debugInfo && debugStatus.enabled) {
    response.debug = debugInfo;
  }

  return NextResponse.json(response, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Build-Marker': BUILD_MARKER,
      'X-Request-Id': requestId,
    },
  });
}

/**
 * Create a new vendor application
 * Server-only route - requires authentication
 */
export async function POST(req: NextRequest) {
  // Generate unique request ID for tracking
  const requestId = randomUUID();
  
  // Initialize debug status with defaults
  let debugStatus = { enabled: false, reason: "missing_debug_param" };
  let debugInfo: Record<string, any> = {};
  
  try {
    // Production-safe debug gating
    const url = new URL(req.url);
    const debugParam = url.searchParams.get("debug") === "1";
    const debugKeyEnv = process.env.DEBUG_KEY;
    
    // Case-insensitive header retrieval (x-debug-key, X-Debug-Key, etc.)
    let debugKeyHeader: string | null = null;
    const headerKeys = ['x-debug-key', 'X-Debug-Key', 'X-DEBUG-KEY'];
    for (const key of headerKeys) {
      const value = req.headers.get(key);
      if (value) {
        debugKeyHeader = value;
        break;
      }
    }
    
    // Diagnostic logging when ?debug=1 is present (safe: no secrets, only lengths/booleans)
    if (debugParam) {
      console.log(`[vendors/create] DEBUG_DIAGNOSTIC | request_id=${requestId} | env_KEY_exists=${!!debugKeyEnv} | env_KEY_length=${debugKeyEnv?.length || 0} | header_KEY_length=${debugKeyHeader?.length || 0} | match=${debugKeyHeader === debugKeyEnv}`);
    }
    
    debugStatus = getDebugStatus(debugParam, debugKeyEnv, debugKeyHeader);
    const debugEnabled = debugStatus.enabled;
    
    // Check for auth cookies in request
    const cookiePresent = hasAuthCookies(req);
    
    // Create session-aware Supabase client that reads cookies
    // Note: createSupabaseServerClient already handles cookies properly via @supabase/ssr
    const supabase = await createSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    // Build debug info if enabled
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
      
      // When debug enabled, include auth error details in response
      const authDebugInfo = debugEnabled ? {
        ...debugInfo,
        auth_error: userError ? {
          message: userError.message,
          status: userError.status,
        } : null,
      } : undefined;
      
      return createErrorResponse(
        "Unauthorized - Please log in to submit a vendor application",
        401,
        requestId,
        debugStatus,
        authDebugInfo
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
      
      const parseDebugInfo = debugStatus.enabled ? {
        ...debugInfo,
        parse_error: parseError instanceof Error ? parseError.message : "Unknown",
      } : undefined;
      
      return createErrorResponse(
        "Invalid request body",
        400,
        requestId,
        debugStatus,
        parseDebugInfo
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
      return createErrorResponse(
        "Business name is required",
        400,
        requestId,
        debugStatus,
        debugStatus.enabled ? debugInfo : undefined
      );
    }

    // Require compliance attestations
    if (!coa_attested) {
      return createErrorResponse(
        "COA attestation is required",
        400,
        requestId,
        debugStatus,
        debugStatus.enabled ? debugInfo : undefined
      );
    }

    if (!intoxicating_policy_ack) {
      return createErrorResponse(
        `Intoxicating products policy acknowledgement is required. Intoxicating products are allowed only until ${getIntoxicatingCutoffDate()}.`,
        400,
        requestId,
        debugStatus,
        debugStatus.enabled ? debugInfo : undefined
      );
    }

    // Check if vendor already exists (approved)
    const { data: existingVendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (existingVendor) {
      return createErrorResponse(
        "Vendor account already exists",
        409,
        requestId,
        debugStatus,
        debugStatus.enabled ? { ...debugInfo, vendor_id: existingVendor.id } : undefined
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
      return createSuccessResponse(
        {
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
        },
        200,
        requestId,
        debugStatus,
        debugStatus.enabled ? debugInfo : undefined
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
        hasUser: !!user,
      });
      
      // When debug enabled, include full Supabase error in response
      const supabaseDebugInfo = debugStatus.enabled ? {
        ...debugInfo,
        supabase_error: {
          code: applicationError.code,
          message: applicationError.message,
          details: applicationError.details,
          hint: applicationError.hint,
        },
      } : undefined;
      
      return createErrorResponse(
        "Failed to submit vendor application. Please try again or contact support.",
        500,
        requestId,
        debugStatus,
        supabaseDebugInfo
      );
    }

    return createSuccessResponse(
      {
        success: true,
        application: application,
        message: "Vendor application submitted. You will be notified once it's reviewed.",
      },
      201,
      requestId,
      debugStatus,
      debugStatus.enabled ? debugInfo : undefined
    );
  } catch (error) {
    // Catch any unexpected errors - ALWAYS return JSON with marker/id/debug_status
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Try to get debug status if available (may fail if error is early)
    let catchDebugStatus = { enabled: false, reason: "error_in_debug_gating" };
    let catchDebugInfo: Record<string, any> = {};
    
    try {
      const url = new URL(req.url);
      const debugParam = url.searchParams.get("debug") === "1";
      const debugKeyEnv = process.env.DEBUG_KEY;
      
      // Case-insensitive header retrieval (same as main try block)
      let debugKeyHeader: string | null = null;
      const headerKeys = ['x-debug-key', 'X-Debug-Key', 'X-DEBUG-KEY'];
      for (const key of headerKeys) {
        const value = req.headers.get(key);
        if (value) {
          debugKeyHeader = value;
          break;
        }
      }
      
      catchDebugStatus = getDebugStatus(debugParam, debugKeyEnv, debugKeyHeader);
      
      if (catchDebugStatus.enabled) {
        // Sanitize stack trace - don't include full stack in production, just message
        catchDebugInfo = {
          unexpected_error: {
            message: errorMessage,
            // Only include stack if in debug mode and it's safe
            ...(errorStack ? { stack: errorStack.substring(0, 500) } : {}),
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
    
    return createErrorResponse(
      "Internal Server Error",
      500,
      requestId,
      catchDebugStatus,
      catchDebugStatus.enabled && Object.keys(catchDebugInfo).length > 0 ? catchDebugInfo : undefined
    );
  }
}
