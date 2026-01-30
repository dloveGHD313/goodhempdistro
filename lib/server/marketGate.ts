import "server-only";
import { require21Plus } from "@/lib/server/idVerification";

type GateOk = { ok: true };
type GateError = {
  ok: false;
  status: number;
  code: "GATED_MARKET_REQUIRES_VERIFICATION" | "ID_VERIFICATION_REQUIRED";
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
  return product.market_category === "INTOXICATING";
}

export async function requireMarketAccess(
  userId: string | null,
  marketType: MarketType
): Promise<GateOk | GateError> {
  if (marketType === "ungated") {
    return { ok: true };
  }
  const gate = await require21Plus(userId);
  if (gate.ok) return { ok: true };
  return {
    ok: false,
    status: gate.status,
    code: gate.code,
    message: gate.message,
    redirectTo: gate.redirectTo,
  };
}
