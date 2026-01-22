import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Safe environment variable presence diagnostics
 * Returns ONLY booleans - never exposes secret values
 * Admin-only endpoint
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication
    const supabase = await createSupabaseServerClient();
    const { user, profile } = await getCurrentUserProfile(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(profile)) {
      return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
    }

    // Check environment variable presence (only booleans, never values)
    const envChecks = {
      has_SUPABASE_SERVICE_ROLE_KEY: !!(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0),
      has_SUPABASE_SECRET_KEY: !!(process.env.SUPABASE_SECRET_KEY && process.env.SUPABASE_SECRET_KEY.trim().length > 0),
      has_SUPABASE_SERVICE_KEY: !!(process.env.SUPABASE_SERVICE_KEY && process.env.SUPABASE_SERVICE_KEY.trim().length > 0),
      has_SUPABASE_SERVICE_ROLE: !!(process.env.SUPABASE_SERVICE_ROLE && process.env.SUPABASE_SERVICE_ROLE.trim().length > 0),
      has_SUPABASE_URL: !!(process.env.SUPABASE_URL && process.env.SUPABASE_URL.trim().length > 0),
      has_NEXT_PUBLIC_SUPABASE_URL: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL.trim().length > 0),
      has_VERCEL_URL: !!(process.env.VERCEL_URL && process.env.VERCEL_URL.trim().length > 0),
      has_NEXT_PUBLIC_SITE_URL: !!(process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim().length > 0),
    };

    // Determine which key is chosen (first present in priority order)
    let chosenKeyName: string | null = null;
    if (envChecks.has_SUPABASE_SERVICE_ROLE_KEY) {
      chosenKeyName = "SUPABASE_SERVICE_ROLE_KEY";
    } else if (envChecks.has_SUPABASE_SECRET_KEY) {
      chosenKeyName = "SUPABASE_SECRET_KEY";
    } else if (envChecks.has_SUPABASE_SERVICE_KEY) {
      chosenKeyName = "SUPABASE_SERVICE_KEY";
    } else if (envChecks.has_SUPABASE_SERVICE_ROLE) {
      chosenKeyName = "SUPABASE_SERVICE_ROLE";
    }

    console.log(
      `[admin/diag/env] Admin ${user.id} checked env vars. ` +
      `chosenKeyName=${chosenKeyName}, ` +
      `has_URL=${envChecks.has_SUPABASE_URL || envChecks.has_NEXT_PUBLIC_SUPABASE_URL}`
    );

    return NextResponse.json(
      {
        ...envChecks,
        chosenKeyName,
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
