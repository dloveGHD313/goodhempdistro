import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";

type GateOk = { ok: true };
type GateError = {
  ok: false;
  status: number;
  code: "GATED_MARKET_REQUIRES_VERIFICATION";
  message: string;
};

export async function requireGatedAccess(userId: string | null): Promise<GateOk | GateError> {
  if (!userId) {
    return {
      ok: false,
      status: 403,
      code: "GATED_MARKET_REQUIRES_VERIFICATION",
      message: "Gated market requires 21+ verification.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("age_verified, id_verification_status, role")
    .eq("id", userId)
    .maybeSingle();

  const verified = data?.age_verified === true && data?.id_verification_status === "verified";
  if (verified || data?.role === "admin") {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    code: "GATED_MARKET_REQUIRES_VERIFICATION",
    message: "Gated market requires 21+ verification.",
  };
}
