import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { resolveVendorPriceId } from "@/lib/pricing";
import { compedCheckoutBlock } from "@/lib/server/vendorComp";

/** Map legacy planName to internal planKey (monthly). Growth -> Pro for backwards compat. */
function planNameToPlanKey(planName: string | null): string | null {
  if (!planName) return null;
  const n = planName.trim().toLowerCase();
  if (n.includes("starter") || n.includes("basic")) return "vendor_starter_monthly";
  if (n.includes("growth")) return "vendor_pro_monthly";
  if (n.includes("enterprise") || n.includes("elite")) return "vendor_enterprise_monthly";
  if (n.includes("pro")) return "vendor_pro_monthly";
  return null;
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
    const planKey = planNameToPlanKey(planName);
    const priceId = planKey ? resolveVendorPriceId(planKey, "monthly") : null;

    if (!priceId) {
      return NextResponse.json(
        { error: "Vendor plan is not configured or invalid" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: vendor } = await admin
      .from("vendors")
      .select("id, owner_user_id, business_name, stripe_customer_id, comp_until")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor account required" },
        { status: 404 }
      );
    }

    // Founding-vendor comp: no paid checkout while the free window is open.
    const compBlock = compedCheckoutBlock(vendor.comp_until);
    if (compBlock) {
      return NextResponse.json(
        { error: compBlock.message, errorReason: "founding_vendor_comped", compUntil: compBlock.compUntil },
        { status: 409 }
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
