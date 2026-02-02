import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { STRIPE_PRICES, type PlanKey } from "@/lib/stripe/prices";

function resolveVendorPriceId(planName: string | null): string | null {
  if (!planName) return null;
  const normalized = planName.trim().toLowerCase();
  let planKey: PlanKey | null = null;
  if (normalized.includes("starter") || normalized.includes("basic")) {
    planKey = "VENDOR_STARTER";
  } else if (normalized.includes("growth")) {
    planKey = "VENDOR_GROWTH";
  } else if (
    normalized.includes("pro") ||
    normalized.includes("enterprise") ||
    normalized.includes("elite")
  ) {
    planKey = "VENDOR_PRO";
  }
  if (!planKey) return null;
  return STRIPE_PRICES[planKey].MONTHLY;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const planName = typeof body?.planName === "string" ? body.planName : null;
    const priceId = resolveVendorPriceId(planName);

    if (!priceId) {
      return NextResponse.json(
        { error: "Vendor plan is not configured" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: vendor } = await admin
      .from("vendors")
      .select("id, owner_user_id, business_name, stripe_customer_id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor account required" },
        { status: 404 }
      );
    }

    let stripeCustomerId = vendor.stripe_customer_id || null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: vendor.business_name || undefined,
        metadata: {
          user_id: user.id,
          vendor_id: vendor.id,
        },
      });
      stripeCustomerId = customer.id;
      await admin
        .from("vendors")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", vendor.id);
    }

    const siteUrl = getSiteUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/vendors/dashboard?checkout=success`,
      cancel_url: `${siteUrl}/pricing?tab=vendor`,
      client_reference_id: user.id,
      metadata: {
        plan_type: "vendor",
        plan_name: planName || "",
        price_id: priceId,
        vendor_id: vendor.id,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          plan_type: "vendor",
          plan_name: planName || "",
          price_id: priceId,
          vendor_id: vendor.id,
          user_id: user.id,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Vendor checkout failed", error);
    return NextResponse.json(
      { error: "Failed to create vendor checkout session" },
      { status: 500 }
    );
  }
}
