import { NextRequest, NextResponse } from "next/server";
import { stripe, getSiteUrl } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { packageSlug, affiliateCode } = await req.json();

    if (!packageSlug) {
      return NextResponse.json(
        { error: "packageSlug is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { data: selectedPackage, error: packageError } = await supabase
      .from("consumer_packages")
      .select("id, slug, name, stripe_price_id, monthly_price_cents")
      .eq("slug", packageSlug)
      .eq("is_active", true)
      .single();

    if (packageError || !selectedPackage) {
      return NextResponse.json(
        { error: `Invalid package: ${packageSlug}` },
        { status: 400 }
      );
    }

    if (!selectedPackage.stripe_price_id) {
      return NextResponse.json(
        { error: "Stripe price ID is not configured for this package" },
        { status: 400 }
      );
    }

    const siteUrl = getSiteUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: selectedPackage.stripe_price_id,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/dashboard?success=consumer`,
      cancel_url: `${siteUrl}/get-started`,
      client_reference_id: user.id,
      metadata: {
        package_type: "consumer",
        package_name: selectedPackage.name,
        package_slug: selectedPackage.slug,
        user_id: user.id,
        affiliate_code: affiliateCode || "",
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          package_type: "consumer",
          package_slug: selectedPackage.slug,
        },
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[consumer/checkout]", errorMessage);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
