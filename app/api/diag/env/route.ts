import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  const debugKey = process.env.DEBUG_KEY;
  const requestKey = req.nextUrl.searchParams.get("key");

  if (isProd) {
    if (!debugKey) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (requestKey !== debugKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.json({
    stripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
    stripePublishable: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  });
}
