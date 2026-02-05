import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * GET: Single logistics_application (on_demand_driver) by id. Admin only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdminUsers(req);
  if (!adminCheck.user || !adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("logistics_applications")
    .select("*")
    .eq("id", id)
    .eq("type", "on_demand_driver")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch application" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
