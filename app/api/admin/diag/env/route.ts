import { NextRequest, NextResponse } from "next/server";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { isMaintenanceModeEnabled } from "@/lib/server/maintenance";

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
    const adminCheck = await requireAdminUsers(req);
    if (!adminCheck.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!adminCheck.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
    }

    const presence = (name: string): "present" | "missing" => {
      const value = process.env[name];
      return value && value.trim().length > 0 ? "present" : "missing";
    };

    const requiredEnv = {
      NEXT_PUBLIC_SUPABASE_URL: presence("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: presence("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: presence("SUPABASE_SERVICE_ROLE_KEY"),
      STRIPE_SECRET_KEY: presence("STRIPE_SECRET_KEY"),
      STRIPE_WEBHOOK_SECRET: presence("STRIPE_WEBHOOK_SECRET"),
      NEXT_PUBLIC_SITE_URL: presence("NEXT_PUBLIC_SITE_URL"),
    };

    return NextResponse.json(
      {
        ok: true,
        maintenanceMode: isMaintenanceModeEnabled(),
        requiredEnv,
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
