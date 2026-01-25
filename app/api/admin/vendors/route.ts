import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/**
 * Get all vendor applications (admin only)
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

    const admin = getSupabaseAdminClient();

    const { data: applications, error } = await admin
      .from("vendor_applications")
      .select("id, user_id, business_name, description, status, created_at, updated_at, profiles(display_name, email)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching vendor applications:", error);
      return NextResponse.json(
        { error: "Failed to fetch vendor applications" },
        { status: 500 }
      );
    }

    // Normalize profiles relation
    const normalized = (applications || []).map((app: any) => ({
      ...app,
      profiles: Array.isArray(app.profiles) ? app.profiles[0] : app.profiles,
    }));

    return NextResponse.json({ applications: normalized });
  } catch (error) {
    console.error("Admin vendors GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
