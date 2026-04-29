import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { resolveIsAdmin } from "@/lib/server/isAdmin";
import { stripe } from "@/lib/stripe";

export async function POST(_req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await resolveIsAdmin(user.id, user.email);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: payouts, error: payoutsError } = await admin
    .from("affiliate_payouts")
    .select("id, affiliate_user_id, amount_cents")
    .eq("status", "pending")
    .lte("scheduled_after", now);

  if (payoutsError) {
    return NextResponse.json({ processed: 0, errors: [payoutsError.message] }, { status: 500 });
  }

  const errors: string[] = [];
  let processed = 0;

  for (const payout of payouts ?? []) {
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", payout.affiliate_user_id)
      .maybeSingle();

    if (!profile?.stripe_account_id) {
      errors.push(`payout ${payout.id}: missing stripe_account_id`);
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: payout.amount_cents,
        currency: "usd",
        destination: profile.stripe_account_id,
        metadata: {
          affiliate_payout_id: payout.id,
          affiliate_user_id: payout.affiliate_user_id,
        },
      });

      const { error: updateError } = await admin
        .from("affiliate_payouts")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_transfer_id: transfer.id,
        })
        .eq("id", payout.id);

      if (updateError) {
        errors.push(`payout ${payout.id}: ${updateError.message}`);
        continue;
      }

      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`payout ${payout.id}: ${message}`);
    }
  }

  return NextResponse.json({ processed, errors });
}
