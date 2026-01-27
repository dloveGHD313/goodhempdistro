import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getConsumerPlanEnvStatus } from "@/lib/consumer-plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Safe environment variable presence diagnostics
 * Returns ONLY booleans - never exposes secret values
 * Admin-only endpoint
 * 
 * Whitespace-only values should be treated as missing.
 */
export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
    }

    // Check environment variable presence (only booleans, never values)
    // Whitespace-only values should be treated as missing
    const v_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const v_SECRET_KEY = process.env.SUPABASE_SECRET_KEY?.trim();
    const v_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY?.trim();
    const v_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE?.trim();
    const v_URL = process.env.SUPABASE_URL?.trim();
    const v_PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const v_VERCEL_URL = process.env.VERCEL_URL?.trim();
    const v_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim();

    const envChecks = {
      has_SUPABASE_SERVICE_ROLE_KEY: Boolean(v_SERVICE_ROLE_KEY),
      has_SUPABASE_SECRET_KEY: Boolean(v_SECRET_KEY),
      has_SUPABASE_SERVICE_KEY: Boolean(v_SERVICE_KEY),
      has_SUPABASE_SERVICE_ROLE: Boolean(v_SERVICE_ROLE),
      has_SUPABASE_URL: Boolean(v_URL),
      has_NEXT_PUBLIC_SUPABASE_URL: Boolean(v_PUBLIC_URL),
      has_VERCEL_URL: Boolean(v_VERCEL_URL),
      has_NEXT_PUBLIC_SITE_URL: Boolean(v_SITE_URL),
    };

    // Determine which key is chosen (first present in priority order)
    // Only consider keys whose trimmed value is non-empty
    let chosenKeyName: string | null = null;
    let chosenKeyValueLength: number | null = null;
    
    if (v_SERVICE_ROLE_KEY) {
      chosenKeyName = "SUPABASE_SERVICE_ROLE_KEY";
      chosenKeyValueLength = v_SERVICE_ROLE_KEY.length;
    } else if (v_SECRET_KEY) {
      chosenKeyName = "SUPABASE_SECRET_KEY";
      chosenKeyValueLength = v_SECRET_KEY.length;
    } else if (v_SERVICE_KEY) {
      chosenKeyName = "SUPABASE_SERVICE_KEY";
      chosenKeyValueLength = v_SERVICE_KEY.length;
    } else if (v_SERVICE_ROLE) {
      chosenKeyName = "SUPABASE_SERVICE_ROLE";
      chosenKeyValueLength = v_SERVICE_ROLE.length;
    }

    console.log(
      `[admin/diag/env] Admin ${adminCheck.user.id} checked env vars. ` +
      `chosenKeyName=${chosenKeyName}, ` +
      `has_URL=${envChecks.has_SUPABASE_URL || envChecks.has_NEXT_PUBLIC_SUPABASE_URL}`
    );

    const consumerPlanEnvStatus = getConsumerPlanEnvStatus();

    return NextResponse.json(
      {
        ...envChecks,
        chosenKeyName,
        chosenKeyValueLength,
        consumerPlans: consumerPlanEnvStatus,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin/diag/env] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: errorMessage,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
