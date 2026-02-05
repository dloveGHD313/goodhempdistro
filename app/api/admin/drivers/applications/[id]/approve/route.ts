import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * POST: Approve on-demand driver application. Admin only.
 * Atomic: creates driver (with application_id + applicant identity) then marks application approved.
 * Never returns success unless driver row is created. Uses RPC admin_approve_driver_application.
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

  const { data: driverId, error } = await admin.rpc("admin_approve_driver_application", {
    p_application_id: id,
    p_admin_user_id: adminCheck.user.id,
  });

  if (error) {
    const code = error.code ?? "";
    const msg = error.message ?? "Failed to approve";
    if (code === "P0001" || msg.includes("already reviewed")) {
      return NextResponse.json(
        { error: "Application not found or already reviewed" },
        { status: 400 }
      );
    }
    if (code === "23505") {
      return NextResponse.json(
        { error: "Application already approved (driver already exists)" },
        { status: 400 }
      );
    }
    if (msg.includes("not admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[admin/drivers/applications/approve] RPC error", code, msg.slice(0, 80));
    return NextResponse.json(
      { error: "Failed to approve application" },
      { status: 500 }
    );
  }

  const suffix =
    typeof driverId === "string" && driverId.length >= 8
      ? driverId.slice(-8)
      : undefined;

  return NextResponse.json({
    success: true,
    ...(suffix ? { driverIdSuffix: suffix } : {}),
  });
}
