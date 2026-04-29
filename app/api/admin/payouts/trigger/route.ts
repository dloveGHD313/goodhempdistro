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

  const { data: claimedPayouts, error: claimError } = await admin
    .from("affiliate_payouts")
    .update({ status: "processing" })
    .eq("status", "pending")
    .lte("scheduled_after", now)
    .select("id, affiliate_user_id, amount_cents");

  if (claimError) {
    return NextResponse.json({ processed: 0, errors: [claimError.message] }, { status: 500 });
  }

  const errors: string[] = [];
  let processed = 0;

  for (const payout of claimedPayouts ?? []) {
    const { data: connectAccount } = await admin
      .from("vendor_connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", payout.affiliate_user_id)
      .maybeSingle();

    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", payout.affiliate_user_id)
      .maybeSingle();

    const destinationAccountId = connectAccount?.stripe_account_id ?? profile?.stripe_account_id ?? null;

    if (!destinationAccountId) {
      await admin.from("affiliate_payouts").update({ status: "pending" }).eq("id", payout.id);
      errors.push(`payout ${payout.id}: missing stripe_account_id`);
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: payout.amount_cents,
        currency: "usd",
        destination: destinationAccountId,
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
      await admin.from("affiliate_payouts").update({ status: "pending" }).eq("id", payout.id);
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`payout ${payout.id}: ${message}`);
    }
  }

  return NextResponse.json({ processed, errors });
}
