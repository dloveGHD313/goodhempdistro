import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

const BUCKET = "driver_documents";

/**
 * GET: List driver_documents for an application + signed URLs. Admin only.
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
  const { data: docs, error } = await admin
    .from("driver_documents")
    .select("id, doc_type, file_path, expires_at, status, created_at")
    .eq("application_id", id)
    .order("doc_type");

  if (error) {
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }

  const withUrls = await Promise.all(
    (docs || []).map(async (doc) => {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(doc.file_path, 3600);
      return {
        ...doc,
        view_url: signed?.signedUrl ?? null,
      };
    })
  );

  return NextResponse.json({ documents: withUrls }, { headers: { "Cache-Control": "no-store" } });
}
