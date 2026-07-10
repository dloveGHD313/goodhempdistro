import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { planKeyToTier, TIER_ENTITLEMENTS } from "@/lib/entitlements";
import { isConsumerSubscriptionActive } from "@/lib/consumer-access";
import { generateCouponCode } from "@/lib/coupons";

/**
 * Monthly cron — grants platform member coupons per tier (perks spec
 * 2026-07-10 §4): Basic 1×5%, Plus 2×10%, Premium 4×15%. Free gets none.
 *
 * Idempotency: each coupon carries grant_key `monthly:YYYY-MM:<n>` and the
 * table has a unique (user_id, grant_key) index — re-runs and partial-batch
 * retries insert only what's missing (23505 conflicts are expected no-ops).
 *
 * Coupons expire at the end of the granted month (allotments don't roll
 * over). Authentication mirrors /api/cron/release-reserves: Vercel cron
 * sends Authorization: Bearer <CRON_SECRET>.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ROUTE_NAME = "cron/grant-member-coupons";
const BATCH_LIMIT = 500;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

async function run(req: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    console.error(`[${ROUTE_NAME}] CRON_SECRET not configured`);
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return unauthorized();
  }

  const admin = getSupabaseAdminClient();
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  // expire at end of the granted month (first instant of next month, UTC)
  const expiresAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  ).toISOString();

  const { data: subs, error } = await admin
    .from("consumer_subscriptions")
    .select("user_id, consumer_plan_key, subscription_status")
    .in("subscription_status", ["active", "trialing"])
    .limit(BATCH_LIMIT);

  if (error) {
    console.error(`[${ROUTE_NAME}] subscription query failed:`, error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let granted = 0;
  let skippedExisting = 0;
  let usersProcessed = 0;

  for (const sub of subs || []) {
    if (!sub.user_id || !isConsumerSubscriptionActive(sub.subscription_status)) {
      continue;
    }
    const tier = planKeyToTier(sub.consumer_plan_key);
    const allotment = TIER_ENTITLEMENTS[tier].monthlyCoupons;
    if (!allotment) continue;
    usersProcessed += 1;

    for (let n = 1; n <= allotment.count; n += 1) {
      const grantKey = `monthly:${monthKey}:${n}`;
      const { error: insertError } = await admin.from("consumer_coupons").insert({
        user_id: sub.user_id,
        code: generateCouponCode(),
        percent_off: allotment.percentOff,
        source: "platform",
        status: "active",
        expires_at: expiresAt,
        grant_key: grantKey,
      });
      if (!insertError) {
        granted += 1;
      } else if (insertError.code === "23505") {
        // unique (user_id, grant_key) — already granted this month, or a
        // (vanishingly rare) code collision; treat as already-granted.
        skippedExisting += 1;
      } else {
        console.error(`[${ROUTE_NAME}] insert failed`, {
          userId: sub.user_id,
          grantKey,
          error: insertError.message,
        });
      }
    }
  }

  const summary = { month: monthKey, usersProcessed, granted, skippedExisting };
  console.log(`[${ROUTE_NAME}]`, JSON.stringify(summary));
  return NextResponse.json(summary);
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
