import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";

type GateOk = { ok: true };
type GateError = {
  ok: false;
  status: number;
  code: "GATED_MARKET_REQUIRES_VERIFICATION";
  message: string;
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
  return product.market_category === "INTOXICATING";
}

async function isVerifiedForGatedMarket(userId: string | null): Promise<boolean> {
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

export async function requireMarketAccess(
  userId: string | null,
  marketType: MarketType
): Promise<GateOk | GateError> {
  if (marketType === "ungated") {
    return { ok: true };
  }

  const verified = await isVerifiedForGatedMarket(userId);
  if (verified) return { ok: true };
  return {
    ok: false,
    status: 403,
    code: "GATED_MARKET_REQUIRES_VERIFICATION",
    message: "Intoxicating market requires 21+ verification.",
  };
}
