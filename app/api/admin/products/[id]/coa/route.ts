import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";
import { requiresCOA } from "@/lib/compliance";

/**
 * GET /api/admin/products/[id]/coa
 * Admin-only: fetch COA metadata for a product (no signed URL).
 * Also returns coaRequired so UI can disable Approve when COA required but not verified.
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

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, category_id")
    .eq("id", id)
    .maybeSingle();

  if (productError || !product) {
    return NextResponse.json(
      { error: productError?.message ?? "Product not found" },
      { status: productError ? 500 : 404 }
    );
  }

  // Reads categories.requires_coa as SSOT (GATE-03 cutover).
  let coaRequired = true;
  if (product.category_id) {
    const { data: category } = await admin
      .from("categories")
      .select("slug, name, requires_coa")
      .eq("id", product.category_id)
      .maybeSingle();
    coaRequired = requiresCOA(category ?? undefined);
  }

  const { data: doc, error: docError } = await admin
    .from("product_documents")
    .select("id, storage_path, status, admin_note, created_at")
    .eq("product_id", id)
    .eq("type", "coa")
    .maybeSingle();

  if (docError) {
    return NextResponse.json(
      { error: docError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    document: doc
      ? {
          id: doc.id,
          storage_path: doc.storage_path,
          status: doc.status,
          admin_note: doc.admin_note ?? null,
          uploaded_at: doc.created_at,
        }
      : null,
    coaRequired,
  });
}
