import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * Admin-only driver management API
 * GET: List all driver applications and drivers
 */

async function checkAdminAccess() {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return { authorized: false, error: "Forbidden - Admin access required", status: 403 };
  }

  return { authorized: true, user };
}

export async function GET(req: NextRequest) {
  try {
    const check = await checkAdminAccess();
    if (!check.authorized) {
      return NextResponse.json(
        { error: check.error },
        { status: check.status || 403 }
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
