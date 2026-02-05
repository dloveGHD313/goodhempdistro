import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * POST: Approve on-demand driver application. Admin only.
 * Updates logistics_applications; creates drivers row (profile_id/user_id from email if found).
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
  const admin = getSupabaseAdminClient();

  const { data: app, error: appError } = await admin
    .from("logistics_applications")
    .select("id, email, status")
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
      status: "approved",
      reviewed_by: adminCheck.user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", id);

  if (updateErr) {
    console.error("[admin/drivers/applications/approve] update error", updateErr.message);
    return NextResponse.json({ error: "Failed to approve" }, { status: 500 });
  }

  // Resolve profile by email (case-insensitive; one profile)
  const emailTrim = app.email.trim();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", emailTrim)
    .limit(1)
    .maybeSingle();

  const userId = profile?.id ?? null;

  if (userId) {
    const { error: driverErr } = await admin.from("drivers").upsert(
      {
        user_id: userId,
        status: "approved",
      },
      { onConflict: "user_id" }
    );
    if (driverErr && driverErr.code !== "23505") {
      console.warn("[admin/drivers/applications/approve] driver upsert warning", driverErr.message);
    }
  } else {
    const { error: driverErr } = await admin.from("drivers").insert({
      user_id: null,
      status: "approved",
    });
    if (driverErr) {
      console.warn("[admin/drivers/applications/approve] driver insert (no profile) warning", driverErr.message);
    }
  }

  return NextResponse.json({ success: true });
}
