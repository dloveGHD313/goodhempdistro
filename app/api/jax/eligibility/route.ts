import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getJaxEligibility } from "@/lib/jax/eligibility";
import { getUserMonthlyCount } from "@/lib/jax/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  const eligibility = await getJaxEligibility(user.id, user.email ?? null);
  const currentUsage = eligibility.eligible ? await getUserMonthlyCount(user.id) : 0;
  const percentUsed =
    eligibility.monthlyLimit && eligibility.monthlyLimit > 0
      ? Math.min(100, Math.round((currentUsage / eligibility.monthlyLimit) * 100))
      : null;

  return NextResponse.json({
    eligible: eligibility.eligible,
    tier: eligibility.tier,
    monthlyLimit: eligibility.monthlyLimit,
    currentUsage,
    percentUsed,
  });
}
