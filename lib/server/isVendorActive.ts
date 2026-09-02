import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type VendorActivityRow = {
  status: string | null;
  is_approved: boolean | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  /** Founding-vendor comp: active without Stripe until this ISO timestamp. */
  comp_until?: string | null;
};

/** A vendor is "active" for gating purposes if ANY of:
 *  - profiles.vendor_status === 'active' (SSOT, set by Stripe webhook)
 *  - vendors.subscription_status in ('active','trialing') AND vendors.stripe_subscription_id IS NOT NULL
 *  - vendors.comp_until is in the future (founding-vendor comp granted by an admin)
 *
 *  Legacy paid vendors who subscribed before migration 086 introduced the
 *  SSOT have already been backfilled via 20260506000000_vendor_status_backfill.sql,
 *  so the runtime helper now requires either the SSOT or a real Stripe subscription.
 *  Tier-only fallback was removed to prevent future false-positives.
 */
export function evaluateVendorActive(
  profileVendorStatus: string | null | undefined,
  vendor: VendorActivityRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (profileVendorStatus === "active") return true;
  if (!vendor) return false;
  const hasActiveSub =
    vendor.subscription_status === "active" || vendor.subscription_status === "trialing";
  if (hasActiveSub && vendor.stripe_subscription_id) return true;
  if (isCompActive(vendor.comp_until, now)) return true;
  return false;
}

/** True when a founding-vendor comp window is set and has not expired. */
export function isCompActive(compUntil: string | null | undefined, now: Date = new Date()): boolean {
  if (!compUntil) return false;
  const t = Date.parse(compUntil);
  return Number.isFinite(t) && t > now.getTime();
}

export async function loadVendorActivity(
  supabase: SupabaseClient,
  userId: string,
): Promise<VendorActivityRow | null> {
  const { data } = await supabase
    .from("vendors")
    .select("status, is_approved, subscription_status, stripe_subscription_id, comp_until")
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
