import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Get current user's driver status
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check application status
    const { data: application } = await supabase
      .from("driver_applications")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    // Check if approved driver
    const { data: driver } = await supabase
      .from("drivers")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      application: application || null,
      driver: driver || null,
    });
  } catch (error) {
    console.error("Get driver status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
