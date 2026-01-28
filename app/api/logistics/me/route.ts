import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Get current user's logistics application status
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: application } = await supabase
      .from("logistics_applications")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({ application: application || null });
  } catch (error) {
    console.error("Get logistics status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
