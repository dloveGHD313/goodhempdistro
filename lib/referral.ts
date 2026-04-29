import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";

const REFERRAL_COOKIE_NAME = "ghd_affiliate_ref";
const REFERRAL_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export const COMMISSION_RATES: Record<string, number> = { starter: 700, mid: 500, top: 100 };
export const LISTING_LIMITS: Record<string, number | null> = { starter: 15, mid: 100, top: null };
export const LOYALTY_POINTS_PER_FREE_REFERRAL = 1;

export function captureReferralCode() {
  if (typeof window === "undefined") return null;
  const refCode = new URLSearchParams(window.location.search).get("ref");
  if (refCode && /^[A-Z0-9\-]+$/.test(refCode)) {
    document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(refCode)}; max-age=${REFERRAL_COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
    return refCode;
  }
  return null;
}

export function getReferralCode(): string | null {
  if (typeof document === "undefined") return null;
  for (const cookie of document.cookie.split(";")) {
    const [name, value] = cookie.trim().split("=");
    if (name === REFERRAL_COOKIE_NAME && value) return decodeURIComponent(value);
  }
  return null;
}

export function clearReferralCode() {
  if (typeof document === "undefined") return;
  document.cookie = `${REFERRAL_COOKIE_NAME}=; max-age=0; path=/`;
}

export async function generateReferralCode(userId: string): Promise<string> {
  const admin = getSupabaseAdminClient();
  const { data: existing } = await admin.from("referral_codes").select("code").eq("user_id", userId).maybeSingle();
  if (existing?.code) return existing.code;

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 10; i++) {
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const { data: conflict } = await admin.from("referral_codes").select("id").eq("code", code).maybeSingle();
    if (conflict) continue;

    const { error } = await admin.from("referral_codes").insert({ user_id: userId, code });
    if (!error) return code;

    const isUniqueConflict = error.code === "23505" || /unique/i.test(error.message || "");
    if (isUniqueConflict) {
      const { data: raced } = await admin.from("referral_codes").select("code").eq("user_id", userId).maybeSingle();
      if (raced?.code) return raced.code;
      continue;
    }

    throw new Error(`referral_code_insert_failed:${error.code ?? "unknown"}`);
  }

  const { data: raced } = await admin.from("referral_codes").select("code").eq("user_id", userId).maybeSingle();
  if (raced?.code) return raced.code;
  throw new Error("failed_referral_code_generation");
}

export async function getLoyaltyBalance(userId: string): Promise<number> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("loyalty_points_ledger").select("balance_after").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.balance_after ?? 0;
}

export async function awardLoyaltyPoints(referrerId: string, _referredUserId: string, referralEventId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("award_loyalty_points", {
    p_user_id: referrerId,
    p_points: LOYALTY_POINTS_PER_FREE_REFERRAL,
    p_event_type: "free_referral_earn",
    p_referral_event_id: referralEventId,
    p_description: "Free user referral — 1 point earned",
  });
  if (error) throw error;
}

export async function spendLoyaltyPoints(userId: string, pointsToSpend: number, description: string): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const admin = getSupabaseAdminClient();
  const current = await getLoyaltyBalance(userId);
  if (current < pointsToSpend) return { success: false, newBalance: current, error: "Insufficient points" };
  const next = current - pointsToSpend;
  await admin.from("loyalty_points_ledger").insert({ user_id: userId, points: -pointsToSpend, balance_after: next, event_type: "purchase_redeem", description });
  return { success: true, newBalance: next };
}

export async function queueAffiliatePayouts(params: { affiliateUserId: string; referralEventId: string; planKey: string; planCadence: "monthly" | "annual"; planPriceCents: number; stripeSubscriptionId: string; }): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { affiliateUserId, referralEventId, planKey, planCadence, planPriceCents } = params;
  if (planCadence === "annual") {
    const monthlyEquivalentCents = Math.round(planPriceCents / 12);
    await admin.from("affiliate_payouts").insert({ affiliate_user_id: affiliateUserId, referral_event_id: referralEventId, instalment_number: 1, amount_cents: monthlyEquivalentCents, plan_key: planKey, plan_cadence: planCadence, status: "pending", scheduled_after: new Date().toISOString(), notes: "Annual referral — 100% of 1 month equivalent" });
  } else {
    const instalmentCents = Math.round(planPriceCents / 2);
    const twoMonthsLater = new Date();
    twoMonthsLater.setDate(twoMonthsLater.getDate() + 60);
    await admin.from("affiliate_payouts").insert([{ affiliate_user_id: affiliateUserId, referral_event_id: referralEventId, instalment_number: 1, amount_cents: instalmentCents, plan_key: planKey, plan_cadence: planCadence, status: "pending", scheduled_after: new Date().toISOString(), notes: "Monthly referral instalment 1/2 — 50% of plan price" }, { affiliate_user_id: affiliateUserId, referral_event_id: referralEventId, instalment_number: 2, amount_cents: instalmentCents, plan_key: planKey, plan_cadence: planCadence, status: "pending", scheduled_after: twoMonthsLater.toISOString(), notes: "Monthly referral instalment 2/2 — requires 2 consecutive months" }]);
  }
}

export function getCommissionRateBps(planKey: string): number { const key = planKey.toLowerCase(); if (key.includes("enterprise") || key.includes("vip") || key.includes("top")) return COMMISSION_RATES.top; if (key.includes("pro") || key.includes("mid")) return COMMISSION_RATES.mid; if (key.includes("free")) return COMMISSION_RATES.starter; return COMMISSION_RATES.starter; }
export function getListingLimit(planKey: string): number | null { const key = planKey.toLowerCase(); if (key.includes("enterprise") || key.includes("vip") || key.includes("top")) return LISTING_LIMITS.top; if (key.includes("pro") || key.includes("mid")) return LISTING_LIMITS.mid as number; if (key.includes("free")) return LISTING_LIMITS.starter as number; return LISTING_LIMITS.starter as number; }
export async function checkAffiliateEligibility(userId: string): Promise<{ eligible: boolean; reason?: string }> { const admin = getSupabaseAdminClient(); const { data: profile } = await admin.from("profiles").select("role, consumer_plan").eq("id", userId).maybeSingle(); if (!profile) return { eligible: false, reason: "Profile not found" }; const hasConsumerPlan = Boolean(profile.consumer_plan && profile.consumer_plan !== "starter"); if (!hasConsumerPlan && profile.role !== "vendor" && profile.role !== "admin") return { eligible: false, reason: "You need at least a Beginner consumer account to become an affiliate" }; return { eligible: true }; }
export async function getStripePriceAmount(priceId: string): Promise<number> { try { const price = await stripe.prices.retrieve(priceId); return price.unit_amount ?? 0; } catch { return 0; } }
