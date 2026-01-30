import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth/requireAdmin";

type ActionPayload = {
  verificationId?: string;
  action?: "verify" | "reject";
  notes?: string | null;
};

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: verifications, error } = await supabase
    .from("id_verifications")
    .select("id, user_id, status, created_at, reviewed_at, notes")
    .order("created_at", { ascending: false });

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

export async function PATCH(req: NextRequest) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const body = (await req.json().catch(() => ({}))) as ActionPayload;
  const verificationId = typeof body.verificationId === "string" ? body.verificationId : null;
  const action = body.action === "verify" || body.action === "reject" ? body.action : null;
  const notes = typeof body.notes === "string" ? body.notes : null;

  if (!verificationId || !action) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const { data: verification } = await supabase
    .from("id_verifications")
    .select("id, user_id")
    .eq("id", verificationId)
    .maybeSingle();

  if (!verification) {
    return NextResponse.json({ ok: false, error: "Verification not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const status = action === "verify" ? "approved" : "rejected";

  const { error: updateError } = await supabase
    .from("id_verifications")
    .update({
      status,
      reviewed_at: now,
      reviewer_id: adminCheck.user.id,
      reviewed_by: adminCheck.user.id,
      notes,
    })
    .eq("id", verificationId);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  const profileUpdate = action === "verify"
    ? { age_verified: true, id_verification_status: "approved", id_verified_at: now }
    : { age_verified: false, id_verification_status: "rejected" };

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", verification.user_id);

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
