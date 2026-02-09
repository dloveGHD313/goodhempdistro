import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";

/** Single source of truth: profiles.vendor_status. Only "pending" | "active". Admin bypass: isAdminEmail(ADMIN_EMAILS) allows access without DB check; API admin uses admin_users elsewhere. */
export async function getVendorStatus(userId: string | null, userEmail?: string | null): Promise<"pending" | "active" | null> {
  if (!userId) return null;
  if (isAdminEmail(userEmail)) return "active";

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("vendor_status")
    .eq("id", userId)
    .maybeSingle();

  const v = (data as { vendor_status?: string | null } | null)?.vendor_status;
  if (v === "pending" || v === "active") return v;
  return null;
}

/** Returns 403 JSON when vendor_status !== "active". Use in vendor-only APIs. */
export async function requireVendorActive(
  userId: string | null,
  userEmail?: string | null
): Promise<{ allowed: true } | { allowed: false; status: 403; json: { error: string } }> {
  if (!userId) {
    return { allowed: false, status: 403, json: { error: "Unauthorized" } };
  }
  if (isAdminEmail(userEmail)) {
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
