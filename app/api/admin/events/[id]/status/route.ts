import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/**
 * Update event status (admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await req.json();

  if (!status || !["draft", "published", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  try {
    const { error: updateError } = await admin
      .from("events")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating event status:", updateError);
      return NextResponse.json(
        { error: "Failed to update event status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin event status PATCH error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
