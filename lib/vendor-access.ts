import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isAdminEmail } from "@/lib/admin";

export type VendorAccessStatus = {
  isVendor: boolean;
  isSubscribed: boolean;
  subscriptionStatus: string | null;
  vendorId: string | null;
  isAdmin: boolean;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export async function getVendorAccessStatus(
  userId: string,
  userEmail?: string | null
): Promise<VendorAccessStatus> {
  if (isAdminEmail(userEmail)) {
    return {
      isVendor: true,
      isSubscribed: true,
      subscriptionStatus: "admin",
      vendorId: null,
      isAdmin: true,
    };
  }

  const supabase = await createSupabaseServerClient();
  type VendorRow = { id: string; owner_user_id: string; subscription_status: string | null };
  let vendor: VendorRow | null = null;

  const { data, error } = await supabase
    .from("vendors")
    .select("id, owner_user_id, subscription_status")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (!error) {
    vendor = (data as VendorRow | null) ?? null;
  } else {
    const admin = getSupabaseAdminClient();
    const { data: adminVendor } = await admin
      .from("vendors")
      .select("id, owner_user_id, subscription_status")
      .eq("owner_user_id", userId)
      .maybeSingle();
    vendor = (adminVendor as VendorRow | null) ?? null;
  }

  if (!vendor || vendor.owner_user_id !== userId) {
    return {
      isVendor: false,
      isSubscribed: false,
      subscriptionStatus: null,
      vendorId: null,
      isAdmin: false,
    };
  }

  const subscriptionStatus = vendor.subscription_status || null;
  const isSubscribed = subscriptionStatus
    ? ACTIVE_STATUSES.has(subscriptionStatus)
    : false;

  return {
    isVendor: true,
    isSubscribed,
    subscriptionStatus,
    vendorId: vendor.id,
    isAdmin: false,
  };
}
