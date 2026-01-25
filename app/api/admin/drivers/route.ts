import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/**
 * Admin-only driver management API
 * GET: List all driver applications and drivers
 */

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdminClient();
    
    // Get applications
    const { data: applications, error: appsError } = await admin
      .from("driver_applications")
      .select("*")
      .order("created_at", { ascending: false });

    // Get approved drivers
    const { data: drivers, error: driversError } = await admin
      .from("drivers")
      .select("*")
      .order("created_at", { ascending: false });

    if (appsError || driversError) {
      console.error("Error fetching drivers:", appsError || driversError);
      return NextResponse.json(
        { error: "Failed to fetch driver data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      applications: applications || [],
      drivers: drivers || [],
    });
  } catch (error) {
    console.error("Driver GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
