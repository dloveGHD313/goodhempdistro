import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * POST: Reject on-demand driver application. Admin only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdminUsers(req);
  if (!adminCheck.user || !adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const rejection_reason = typeof body.rejection_reason === "string" ? body.rejection_reason.trim() : null;

  const admin = getSupabaseAdminClient();

  // Update only while status is still 'pending' to avoid race with approve RPC:
  // if approve runs first (FOR UPDATE, insert driver, set approved), this update
  // matches zero rows and we return 400 instead of overwriting to rejected.
  const { data: updated, error: updateErr } = await admin
    .from("logistics_applications")
    .update({
      status: "rejected",
      reviewed_by: adminCheck.user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejection_reason || null,
    })
    .eq("id", id)
    .eq("type", "on_demand_driver")
    .eq("status", "pending")
    .select("id");

  if (updateErr) {
    return NextResponse.json({ error: "Failed to reject" }, { status: 500 });
  }
  if (!updated?.length) {
    return NextResponse.json(
      { error: "Application not found or already reviewed" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
