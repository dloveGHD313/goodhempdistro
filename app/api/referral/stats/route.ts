import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getLoyaltyBalance } from "@/lib/referral";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const [{ data: payoutsByUserId }, { data: affiliate }] = await Promise.all([
    admin.from("affiliate_payouts").select("*").eq("affiliate_user_id", user.id).order("created_at", { ascending: false }),
    admin.from("affiliates").select("id").eq("user_id", user.id).maybeSingle(),
  ]);

  let payouts = payoutsByUserId;
  if (!payouts && affiliate?.id) {
    const { data: payoutsByAffiliateId } = await admin
      .from("affiliate_payouts")
      .select("*")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false });
    payouts = payoutsByAffiliateId;
  }

  const [loyaltyBalance, { data: referralCode }, { data: referralEvents }] = await Promise.all([
    getLoyaltyBalance(user.id),
    admin.from("referral_codes").select("*").eq("user_id", user.id).maybeSingle(),
    admin.from("referral_events").select("*").eq("referrer_user_id", user.id).order("created_at", { ascending: false }),
  ]);

  const pendingPayouts = (payouts ?? []).filter((p) => p.status === "pending");
  const paidPayouts = (payouts ?? []).filter((p) => p.status === "paid");

  return NextResponse.json({ ok: true, loyaltyPoints: { balance: loyaltyBalance, dollarValue: (loyaltyBalance * 0.001).toFixed(2) }, affiliate: { code: referralCode?.code ?? null, totalReferrals: referralEvents?.length ?? 0, pendingPayoutsCents: pendingPayouts.reduce((s, p) => s + p.amount_cents, 0), paidPayoutsCents: paidPayouts.reduce((s, p) => s + p.amount_cents, 0), payouts: payouts ?? [], referralEvents: referralEvents ?? [] } });
}
