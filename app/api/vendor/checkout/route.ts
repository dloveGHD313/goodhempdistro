import { NextRequest, NextResponse } from "next/server";

/**
 * DEPRECATED: This endpoint is no longer used.
 * Vendor subscription checkout uses POST /api/stripe/checkout with productType: "vendor".
 */
export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated. Use POST /api/stripe/checkout with productType: vendor.",
      deprecated: true,
    },
    { status: 410 }
  );
}
