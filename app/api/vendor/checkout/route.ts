import { NextRequest, NextResponse } from "next/server";
import { stripe, getSiteUrl } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const { packageName, userId } = await req.json();

    if (!packageName || !userId) {
      return NextResponse.json(
        { error: "packageName and userId are required" },
        { status: 400 }
      );
    }

    // Define package pricing and metadata
    const packages: Record<string, { name: string; price_cents: number }> = {
      BASIC: { name: "BASIC", price_cents: 5000 },
      PRO: { name: "PRO", price_cents: 12500 },
      ELITE: { name: "ELITE", price_cents: 25000 },
    };

    const selectedPackage = packages[packageName.toUpperCase()];
    if (!selectedPackage) {
      return NextResponse.json(
        { error: `Invalid package: ${packageName}` },
        { status: 400 }
      );
    }

    const siteUrl = getSiteUrl();

    // Create checkout session for vendor package
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Good Hemp Distro - Vendor ${selectedPackage.name} Package`,
              description: `Monthly vendor subscription - ${selectedPackage.name} tier`,
            },
            unit_amount: selectedPackage.price_cents,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/orders/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/vendor-registration`,
      client_reference_id: userId,
      metadata: {
        package_type: "vendor",
        package_name: packageName.toUpperCase(),
        user_id: userId,
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[vendor/checkout]", errorMessage);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
