import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";
import { resolveIsAdmin } from "@/lib/server/isAdmin";
import { evaluateVendorActive, loadVendorActivity } from "@/lib/server/isVendorActive";

/** SSOT: profiles.vendor_status (pending|active) plus legacy fallback via isVendorActive helper.
 *  Admin bypass via resolveIsAdmin() (allowlist + admin_users + profile role).
 */
export async function getVendorStatus(userId: string | null, userEmail?: string | null): Promise<"pending" | "active" | null> {
  if (!userId) return null;
  if (userEmail && (await resolveIsAdmin(userId, userEmail))) return "active";

  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, vendor] = await Promise.all([
    supabase.from("profiles").select("vendor_status").eq("id", userId).maybeSingle(),
    loadVendorActivity(supabase, userId),
  ]);

  const profileVendorStatus = (profile as { vendor_status?: string | null } | null)?.vendor_status ?? null;

  if (evaluateVendorActive(profileVendorStatus, vendor)) return "active";
  if (profileVendorStatus === "pending") return "pending";
  return null;
}

/** Returns 403 JSON when vendor is not active. Use in vendor-only APIs. */
export async function requireVendorActive(
  userId: string | null,
  userEmail?: string | null
): Promise<{ allowed: true } | { allowed: false; status: 403; json: { error: string } }> {
  if (!userId) {
    return { allowed: false, status: 403, json: { error: "Unauthorized" } };
  }
  if (userEmail && (await resolveIsAdmin(userId, userEmail))) {
    return { allowed: true };
  }
  const status = await getVendorStatus(userId, userEmail);
  if (status === "active") {
    return { allowed: true };
  }
  return {
    allowed: false,
    status: 403,
    json: { error: "Vendor subscription required. Choose a plan to activate your vendor account." },
  };
}
