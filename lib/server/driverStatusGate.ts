import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function requireApprovedDriver(
  userId: string | null
): Promise<{ allowed: true; driverId: string } | { allowed: false; status: 401 | 403; json: { error: string } }> {
  if (!userId) {
    return { allowed: false, status: 401, json: { error: "Unauthorized" } };
  }

  const supabase = await createSupabaseServerClient();
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!driver || driver.status !== "approved") {
    return {
      allowed: false,
      status: 403,
      json: { error: "Approved driver account required." },
    };
  }

  return { allowed: true, driverId: driver.id };
}
