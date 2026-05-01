import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { stripe, getSiteUrl } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (vendorError || !vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const { data: existingConnect, error: connectLookupError } = await supabase
    .from("vendor_connect_accounts")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (connectLookupError) {
    return NextResponse.json({ error: "Failed to load Connect account" }, { status: 500 });
  }

  let stripeAccountId = existingConnect?.stripe_account_id ?? null;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: user.email ?? undefined,
      capabilities: {
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            interval: "manual",
          },
        },
      },
      tos_acceptance: {
        service_agreement: "recipient",
      },
      metadata: {
        vendor_id: vendor.id,
        owner_user_id: user.id,
      },
    });

    stripeAccountId = account.id;

    const { error: insertError } = await supabase.from("vendor_connect_accounts").upsert(
      {
        user_id: user.id,
        stripe_account_id: stripeAccountId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (insertError) {
      return NextResponse.json({ error: "Failed to store Stripe account" }, { status: 500 });
    }
  }

  const siteUrl = getSiteUrl(req);
  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${siteUrl}/vendors/payouts?retry=1`,
    return_url: `${siteUrl}/vendors/payouts?connected=1`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
}
