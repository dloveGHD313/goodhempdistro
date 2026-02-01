import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/admin/vendor-referrals/payouts/[id]/approve
 * Stripe Transfer to vendor's Connect account; mark ledger paid; update payout.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { isAdmin } = await requireAdminUsers(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: payoutId } = await context.params;
  const admin = getSupabaseAdminClient();

  const { data: payout, error: payoutError } = await admin
    .from("vendor_referral_payouts")
    .select("id, referrer_vendor_id, amount_cents, status")
    .eq("id", payoutId)
    .single();

  if (payoutError || !payout) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  if (payout.status !== "requested") {
    return NextResponse.json(
      { error: `Payout status is ${payout.status}; only requested can be approved` },
      { status: 400 }
    );
  }

  const { data: vendor } = await admin
    .from("vendors")
    .select("id, owner_user_id")
    .eq("id", payout.referrer_vendor_id)
    .single();

  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const { data: connect } = await admin
    .from("vendor_connect_accounts")
    .select("stripe_account_id")
    .eq("user_id", vendor.owner_user_id)
    .maybeSingle();

  if (!connect?.stripe_account_id) {
    return NextResponse.json(
      { error: "Vendor has no Stripe Connect account" },
      { status: 400 }
    );
  }

  const amount_cents = payout.amount_cents;

  const { data: ledgerRows } = await admin
    .from("vendor_referral_ledger")
    .select("id, amount_cents")
    .eq("referrer_vendor_id", payout.referrer_vendor_id)
    .eq("status", "available")
    .order("created_at", { ascending: true });

  let remaining = amount_cents;
  const toMark: { id: string; amount_cents: number; full: boolean }[] = [];
  for (const row of ledgerRows ?? []) {
    if (remaining <= 0) break;
    const amt = row.amount_cents ?? 0;
    const take = Math.min(remaining, amt);
    toMark.push({ id: row.id, amount_cents: take, full: take >= amt });
    remaining -= take;
  }

  const totalMarked = toMark.reduce((s, r) => s + r.amount_cents, 0);
  if (totalMarked < amount_cents) {
    return NextResponse.json(
      { error: `Insufficient available ledger (need ${amount_cents}¢, have ${totalMarked}¢)` },
      { status: 400 }
    );
  }

  try {
    const transfer = await stripe.transfers.create({
      amount: amount_cents,
      currency: "usd",
      destination: connect.stripe_account_id,
      description: `Vendor referral payout ${payoutId}`,
      metadata: { vendor_referral_payout_id: payoutId },
    });

    const now = new Date().toISOString();
    for (const row of toMark) {
      if (row.full) {
        await admin
          .from("vendor_referral_ledger")
          .update({ status: "paid", payout_id: payoutId, updated_at: now })
          .eq("id", row.id);
      } else {
        const orig = ledgerRows?.find((l) => l.id === row.id);
        const origAmt = orig?.amount_cents ?? 0;
        const leave = origAmt - row.amount_cents;
        if (leave > 0) {
          await admin.from("vendor_referral_ledger").update({ amount_cents: leave, updated_at: now }).eq("id", row.id);
          await admin.from("vendor_referral_ledger").insert({
            referrer_vendor_id: payout.referrer_vendor_id,
            amount_cents: row.amount_cents,
            status: "paid",
            vendor_referral_id: null,
            order_id: null,
            payout_id: payoutId,
            metadata: null,
            created_at: now,
            updated_at: now,
          });
        } else {
          await admin
            .from("vendor_referral_ledger")
            .update({ status: "paid", payout_id: payoutId, updated_at: now })
            .eq("id", row.id);
        }
      }
    }

    await admin
      .from("vendor_referral_payouts")
      .update({
        status: "paid",
        stripe_transfer_id: transfer.id,
        updated_at: now,
      })
      .eq("id", payoutId);

    return NextResponse.json({
      ok: true,
      stripe_transfer_id: transfer.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Stripe transfer failed: ${msg}` },
      { status: 500 }
    );
  }
}
