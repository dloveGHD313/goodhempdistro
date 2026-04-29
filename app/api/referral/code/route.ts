import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { checkAffiliateEligibility, generateReferralCode } from "@/lib/referral";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const eligibility = await checkAffiliateEligibility(user.id);
  if (!eligibility.eligible) return NextResponse.json({ ok: false, eligible: false, reason: eligibility.reason }, { status: 403 });
  const code = await generateReferralCode(user.id);
  return NextResponse.json({ ok: true, code, eligible: true });
}
