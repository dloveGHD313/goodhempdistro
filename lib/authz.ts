import { createSupabaseServerClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UserProfile = {
  id: string;
  role: string | null;
  display_name: string | null;
};

export type VendorInfo = {
  id: string;
  owner_user_id: string;
  business_name: string;
  status: "pending" | "active" | "suspended";
};

/**
 * Get current user's profile
 * Returns null if not authenticated or profile not found
 */
export async function getCurrentUserProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ user: { id: string; email?: string } | null; profile: UserProfile | null }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { user: null, profile: null };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, display_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return { user, profile: null };
    }

    return { user, profile };
  } catch (error) {
    console.error("[authz] Error getting user profile:", error);
    return { user: null, profile: null };
  }
}

/**
 * Check if user is an admin
 */
export function isAdmin(profile: UserProfile | null): boolean {
  return profile?.role === "admin";
}

/**
 * Check if user is a vendor
 * Uses vendors table - vendor exists and is active or pending
 */
export async function isVendor(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<{ isVendor: boolean; vendor: VendorInfo | null }> {
  try {
    const { data: vendor, error } = await supabase
      .from("vendors")
      .select("id, owner_user_id, business_name, status")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (error || !vendor) {
      return { isVendor: false, vendor: null };
    }

    // DEFENSIVE: Verify the vendor belongs to this user
    if (vendor.owner_user_id !== userId) {
      console.error("[authz] SECURITY: Vendor owner_user_id mismatch!", {
        userId,
        vendor_owner_user_id: vendor.owner_user_id,
      });
      return { isVendor: false, vendor: null };
    }

    // Vendor exists - check if active or pending (not suspended)
    return {
      isVendor: vendor.status !== "suspended",
      vendor,
    };
  } catch (error) {
    console.error("[authz] Error checking vendor status:", error);
    return { isVendor: false, vendor: null };
  }
}

/**
 * Get vendor info for current user
 */
export async function getCurrentVendor(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<VendorInfo | null> {
  const { vendor } = await isVendor(supabase, userId);
  return vendor;
}

/**
 * Check if user has vendor context (application or vendor record)
 * Returns true if user has ANY vendor_applications row OR vendors row
 * Optionally returns the application status for UI
 * Includes debug information for troubleshooting (server-only)
 * 
 * IMPORTANT: userId must be from authenticated session (supabase.auth.getUser())
 * If userId is null/undefined, this will return hasContext=false and log an error.
 */
export async function hasVendorContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string | null | undefined
): Promise<{ 
  hasContext: boolean; 
  applicationStatus?: string | null;
  hasVendor: boolean;
  vendorStatus?: string | null;
  _debug?: {
    userId: string | null;
    userExists: boolean;
    applicationFound: boolean;
    applicationStatus: string | null;
    vendorFound: boolean;
    vendorStatus: string | null;
    appError?: string;
    vendorError?: string;
  };
}> {
  // CRITICAL: Check if userId is null/undefined (no session)
  if (!userId) {
    console.error("[authz] hasVendorContext called with null/undefined userId - SSR user session is missing!");
    console.log(`[authz] VENDOR_CONTEXT_MISSING userId=null applicationFound=false vendorFound=false (no_session)`);
    return {
      hasContext: false,
      hasVendor: false,
      _debug: {
        userId: null,
        userExists: false,
        applicationFound: false,
        applicationStatus: null,
        vendorFound: false,
        vendorStatus: null,
      },
    };
  }

  try {
    // Verify user session exists by checking auth
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser || authUser.id !== userId) {
      console.error("[authz] SSR user session mismatch or missing!", {
        providedUserId: userId,
        authUserId: authUser?.id || null,
        authError: authError?.message || null,
      });
      console.log(`[authz] VENDOR_CONTEXT_MISSING userId=${userId} applicationFound=false vendorFound=false (session_mismatch)`);
      return {
        hasContext: false,
        hasVendor: false,
        _debug: {
          userId,
          userExists: false,
          applicationFound: false,
          applicationStatus: null,
          vendorFound: false,
          vendorStatus: null,
          appError: authError?.message || "Session mismatch",
        },
      };
    }

    // Check for vendor application first - MUST use user_id = userId
    const { data: application, error: appError } = await supabase
      .from("vendor_applications")
      .select("id, user_id, status")
      .eq("user_id", userId)
      .maybeSingle();

    // DEFENSIVE: Verify the application belongs to this user
    if (application && application.user_id !== userId) {
      console.error("[authz] SECURITY: Application user_id mismatch in hasVendorContext!", {
        userId,
        application_user_id: application.user_id,
      });
    }

    // Check for vendor record - MUST use owner_user_id = userId
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("id, owner_user_id, status")
      .eq("owner_user_id", userId)
      .maybeSingle();

    // DEFENSIVE: Verify the vendor belongs to this user
    if (vendor && vendor.owner_user_id !== userId) {
      console.error("[authz] SECURITY: Vendor owner_user_id mismatch in hasVendorContext!", {
        userId,
        vendor_owner_user_id: vendor.owner_user_id,
      });
    }

    const hasApplication = !appError && !!application && application.user_id === userId;
    const hasVendor = !vendorError && !!vendor && vendor.owner_user_id === userId;

    // Build debug object (server-only, never sent to client)
    const debug = {
      userId,
      userExists: true,
      applicationFound: hasApplication,
      applicationStatus: application?.status || null,
      vendorFound: hasVendor,
      vendorStatus: vendor?.status || null,
      ...(appError && { appError: appError.message }),
      ...(vendorError && { vendorError: vendorError.message }),
    };

    // Log if context is missing (for troubleshooting)
    if (!hasApplication && !hasVendor) {
      console.log(`[authz] VENDOR_CONTEXT_MISSING userId=${userId} applicationFound=false vendorFound=false`);
    } else {
      // Log when context is found (for verification)
      console.log(`[authz] VENDOR_CONTEXT_FOUND userId=${userId} applicationFound=${hasApplication} vendorFound=${hasVendor} applicationStatus=${application?.status || 'null'} vendorStatus=${vendor?.status || 'null'}`);
    }

    return {
      hasContext: hasApplication || hasVendor,
      applicationStatus: application?.status || null,
      hasVendor,
      vendorStatus: vendor?.status || null,
      _debug: debug, // Server-only, will be stripped if serialized
    };
  } catch (error) {
    console.error("[authz] Error checking vendor context:", error);
    console.log(`[authz] VENDOR_CONTEXT_MISSING userId=${userId || 'null'} applicationFound=false vendorFound=false (exception)`);
    return { 
      hasContext: false, 
      hasVendor: false,
      _debug: {
        userId: userId || null,
        userExists: !!userId,
        applicationFound: false,
        applicationStatus: null,
        vendorFound: false,
        vendorStatus: null,
      },
    };
  }
}
