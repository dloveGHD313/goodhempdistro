import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type VendorActivityRow = {
  status: string | null;
  is_approved: boolean | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
};

/** A vendor is "active" for gating purposes if ANY of:
 *  - profiles.vendor_status === 'active' (SSOT, set by Stripe webhook)
 *  - vendors.subscription_status in ('active','trialing')
 *  - vendors.stripe_subscription_id IS NOT NULL AND vendors.status === 'active'
 *
 *  The OR fallback recognizes legacy paid vendors who subscribed before
 *  migration 086 added the profiles.vendor_status SSOT column.
 */
export function evaluateVendorActive(
  profileVendorStatus: string | null | undefined,
  vendor: VendorActivityRow | null | undefined,
): boolean {
  if (profileVendorStatus === "active") return true;
  if (!vendor) return false;
  if (vendor.subscription_status === "active" || vendor.subscription_status === "trialing") return true;
  if (vendor.stripe_subscription_id && vendor.status === "active") return true;
  return false;
}

export async function loadVendorActivity(
  supabase: SupabaseClient,
  userId: string,
): Promise<VendorActivityRow | null> {
  const { data } = await supabase
    .from("vendors")
    .select("status, is_approved, subscription_status, stripe_subscription_id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return (data as VendorActivityRow | null) ?? null;
}

/** Combined helper: loads profile.vendor_status + vendor row, returns boolean. */
export async function isVendorActive(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, vendor] = await Promise.all([
    supabase.from("profiles").select("vendor_status").eq("id", userId).maybeSingle(),
    loadVendorActivity(supabase, userId),
  ]);
  const profileVendorStatus = (profile as { vendor_status?: string | null } | null)?.vendor_status ?? null;
  return evaluateVendorActive(profileVendorStatus, vendor);
}
