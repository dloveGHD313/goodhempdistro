import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";

type GateOk = { ok: true };
type GateError = {
  ok: false;
  status: number;
  code: "GATED_MARKET_REQUIRES_VERIFICATION";
  message: string;
};

export async function isGatedMarketVerified(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("age_verified, id_verification_status, role")
    .eq("id", userId)
    .maybeSingle();

  return (
    data?.role === "admin" ||
    (data?.age_verified === true && data?.id_verification_status === "verified")
  );
}

export async function enforceGatedAccess(userId: string | null): Promise<GateOk | GateError> {
  const verified = await isGatedMarketVerified(userId);
  if (verified) return { ok: true };
  return {
    ok: false,
    status: 403,
    code: "GATED_MARKET_REQUIRES_VERIFICATION",
    message: "Intoxicating market requires 21+ verification.",
  };
}

export async function requireGatedAccess(userId: string | null): Promise<GateOk | GateError> {
  return enforceGatedAccess(userId);
}
