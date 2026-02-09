import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

const COA_VIEW_SIGNED_URL_TTL_SEC = 60;

/**
 * GET /api/admin/products/[id]/coa/view
 * Admin-only: returns a short-lived signed URL to view the COA file.
 */
export async function GET(
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

  const admin = getSupabaseAdminClient();

  const { data: doc, error: docError } = await admin
    .from("product_documents")
    .select("storage_path, storage_bucket")
    .eq("product_id", id)
    .eq("type", "coa")
    .maybeSingle();

  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }
  if (!doc?.storage_path) {
    return NextResponse.json(
      { error: "No COA document found for this product" },
      { status: 404 }
    );
  }

  const bucket = doc.storage_bucket ?? "coas";
  const path = String(doc.storage_path).replace(/^coas\//, "").trim() || doc.storage_path;

  const { data: signed, error: signError } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, COA_VIEW_SIGNED_URL_TTL_SEC);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signError?.message ?? "Failed to create signed URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: signed.signedUrl });
}
