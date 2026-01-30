import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function GET(req: NextRequest) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam === "pending" || statusParam === "approved" || statusParam === "rejected"
      ? statusParam
      : null;

  let query = supabase
    .from("id_verifications")
    .select("id, user_id, status, created_at, reviewed_at, reviewed_by, notes")
    .order("created_at", { ascending: false });
  if (status) {
    query = query.eq("status", status);
  }
  const { data: verifications, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const verificationIds = (verifications || []).map((row) => row.id);
  const { data: files } = verificationIds.length
    ? await supabase
        .from("id_verification_files")
        .select("id, verification_id, file_path")
        .in("verification_id", verificationIds)
    : { data: [] };

  const fileUrls = await Promise.all(
    (files || []).map(async (file) => {
      const { data } = await supabase
        .storage
        .from("id-verifications")
        .createSignedUrl(file.file_path, 60 * 60);
      return {
        id: file.id,
        verification_id: file.verification_id,
        file_path: file.file_path,
        url: data?.signedUrl || null,
      };
    })
  );

  return NextResponse.json({
    ok: true,
    verifications: verifications || [],
    files: fileUrls.filter((file) => file.url),
  });
}
