import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { getVendorAccessStatus } from "@/lib/vendor-access";

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getVendorAccessStatus(user.id, user.email);
    if (!access.isAdmin && !access.isSubscribed) {
      return NextResponse.json({ error: "Subscription required" }, { status: 403 });
    }

    const admin = getSupabaseAdminClient();
    const { data: vendor } = await admin
      .from("vendors")
      .select("id, stripe_customer_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!vendor?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Billing profile not found" },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: vendor.stripe_customer_id,
      return_url: `${getSiteUrl()}/vendors/billing?portal=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[stripe/portal] error", error);
    }
    return NextResponse.json(
      { error: "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
