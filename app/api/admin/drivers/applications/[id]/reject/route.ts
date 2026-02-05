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
  const { data: app, error: appError } = await admin
    .from("logistics_applications")
    .select("id, status")
    .eq("id", id)
    .eq("type", "on_demand_driver")
    .maybeSingle();

  if (appError || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (app.status !== "pending") {
    return NextResponse.json({ error: "Application already reviewed" }, { status: 400 });
  }

  const { error: updateErr } = await admin
    .from("logistics_applications")
    .update({
      status: "rejected",
      reviewed_by: adminCheck.user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejection_reason || null,
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to reject" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
