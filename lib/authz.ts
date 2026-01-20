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
