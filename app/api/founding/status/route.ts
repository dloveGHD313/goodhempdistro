import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getStripeServer } from "@/lib/stripe/server";
import { activateFoundingSpot, getFoundingRow } from "@/lib/server/founding";
import { normalizeFoundingInterval } from "@/lib/founding";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" } as const;

/**
 * GET /api/founding/status?session_id=cs_...
 * The signed-in user's founding status. When a Checkout session id is supplied and
 * the row is still pending, verify the session with Stripe directly and activate —
 * so the success page shows the founding number even if the webhook is a few
 * seconds behind (or a retry is queued).
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });

  let row = await getFoundingRow(user.id);
  const sessionId = new URL(req.url).searchParams.get("session_id");

  if (row && row.status !== "active" && sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    try {
      const stripe = getStripeServer();
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
      const ownerId = session.client_reference_id || session.metadata?.user_id;
      const subscription = typeof session.subscription === "string" ? null : session.subscription;
      if (ownerId === user.id && session.metadata?.founding === "1" && session.status === "complete" && subscription) {
        await activateFoundingSpot({
          userId: user.id,
          sessionId: session.id,
          subscriptionId: subscription.id,
          planKey: session.metadata?.plan_key || null,
          interval: normalizeFoundingInterval(session.metadata?.founding_interval ?? session.metadata?.cadence),
          trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        });
        row = await getFoundingRow(user.id);
      }
    } catch (err) {
      console.error("[founding/status] session verify failed:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json(
    {
      status: row?.status ?? "none",
      foundingNumber: row?.founding_number ?? null,
      billingInterval: row?.billing_interval ?? null,
      trialEnd: row?.trial_end ?? null,
    },
    { headers: noStore }
  );
}
