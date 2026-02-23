import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";

type GateOk = { ok: true };
type GateError = {
  ok: false;
  status: number;
  code: "GATED_MARKET_REQUIRES_VERIFICATION";
  message: string;
  redirectTo?: string;
};

type MarketType = "gated" | "ungated";

type GateProduct = {
  market_mode?: MarketType | null;
  is_gated?: boolean | null;
  market_category?: string | null;
};

export function isGatedProduct(product: GateProduct | null | undefined): boolean {
  if (!product) return false;
  if (product.market_mode === "gated") return true;
  if (product.is_gated === true) return true;
  return (
    product.market_category === "RECREATIONAL" ||
    product.market_category === "INTOXICATING"
  );
}

const GATED_MESSAGE = "21+ verification is required to access gated products.";
const GATED_REDIRECT = "/verify";

/**
 * Checks profiles.age_verified and profiles.id_verification_status === 'verified'.
 * Admin bypass: admins get ok: true.
 */
export async function requireGatedAccess(
  userId: string | null,
  redirectTo = GATED_REDIRECT
): Promise<GateOk | GateError> {
  if (!userId) {
    return {
      ok: false,
      status: 403,
      code: "GATED_MARKET_REQUIRES_VERIFICATION",
      message: GATED_MESSAGE,
      redirectTo,
    };
  }
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, roles, age_verified, id_verification_status")
    .eq("id", userId)
    .maybeSingle();

  if (hasRole(profile ?? undefined, "admin")) {
    return { ok: true };
  }

  const verified =
    profile?.age_verified === true &&
    (profile?.id_verification_status === "verified" ||
      profile?.id_verification_status === "approved");

  if (verified) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    code: "GATED_MARKET_REQUIRES_VERIFICATION",
    message: GATED_MESSAGE,
    redirectTo,
  };
}

export async function requireMarketAccess(
  userId: string | null,
  marketType: MarketType,
  redirectTo = GATED_REDIRECT
): Promise<GateOk | GateError> {
  if (marketType === "ungated") {
    return { ok: true };
  }
  return requireGatedAccess(userId, redirectTo);
}
