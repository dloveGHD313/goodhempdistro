import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

/**
 * PATCH /api/admin/products/[id]/coa/status
 * Admin-only: set product_documents COA status (verified | rejected) and optional admin_note.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdminUsers(req);
  if (!adminCheck.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Product ID required" }, { status: 400 });
  }

  let body: { status?: string; admin_note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = body.status;
  if (status !== "verified" && status !== "rejected") {
    return NextResponse.json(
      { error: "status must be 'verified' or 'rejected'" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();

  const update: { status: string; admin_note?: string | null; updated_at: string } = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "rejected" && body.admin_note !== undefined) {
    update.admin_note = body.admin_note === "" ? null : String(body.admin_note).trim() || null;
  } else if (status === "verified") {
    update.admin_note = null;
  }

  const { data, error } = await admin
    .from("product_documents")
    .update(update)
    .eq("product_id", id)
    .eq("type", "coa")
    .select("id, status, admin_note")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "No COA document found for this product" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    document: { id: data.id, status: data.status, admin_note: data.admin_note ?? null },
  });
}
