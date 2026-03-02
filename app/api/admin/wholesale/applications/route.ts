import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * GET: List wholesale_applications (admin only).
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
    .from("wholesale_applications")
    .select(
      "id, user_id, status, business_name, business_type, company_size, products_sourcing, certificate_path, submitted_at, reviewed_at, reviewed_by, notes, created_at, updated_at"
    )
    .order("submitted_at", { ascending: false });

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[admin/wholesale/applications] list error", error.message);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }

  return NextResponse.json({ applications: data ?? [] });
}
