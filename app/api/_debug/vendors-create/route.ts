import { NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUILD_MARKER = "vendors-create-debug-v3";

/**
 * Debug endpoint to verify deployment
 * Returns build marker and whether DEBUG_KEY is configured
 */
export async function GET() {
  const deployedAt = new Date().toISOString();
  const hasDebugKey = Boolean(process.env.DEBUG_KEY && process.env.DEBUG_KEY.length > 0);

  return NextResponse.json(
    {
      build_marker: BUILD_MARKER,
      deployed_at: deployedAt,
      has_DEBUG_KEY_env: hasDebugKey,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Build-Marker': BUILD_MARKER,
      },
    }
  );
}
