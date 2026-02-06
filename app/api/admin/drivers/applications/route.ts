import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * GET: List logistics_applications with type=on_demand_driver (admin only).
 * Query: status=pending|approved|rejected (optional)
 */
export async function GET(req: NextRequest) {
  const adminCheck = await requireAdminUsers(req);
  if (!adminCheck.user || !adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const admin = getSupabaseAdminClient();
  let query = admin
    .from("logistics_applications")
    .select("id, full_name, email, phone, service_area, vehicle_type, notes, status, created_at, reviewed_at, rejection_reason")
    .eq("type", "on_demand_driver")
    .order("created_at", { ascending: false });

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[admin/drivers/applications] list error", error.message);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }

  return NextResponse.json({ applications: data ?? [] });
}
