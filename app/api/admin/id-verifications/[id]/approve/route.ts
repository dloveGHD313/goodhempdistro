import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth/requireAdmin";

type ActionPayload = {
  notes?: string | null;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Invalid verification ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const body = (await req.json().catch(() => ({}))) as ActionPayload;
  const notes = typeof body.notes === "string" ? body.notes : null;

  const { data: verification } = await supabase
    .from("id_verifications")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!verification) {
    return NextResponse.json({ ok: false, error: "Verification not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("id_verifications")
    .update({
      status: "approved",
      reviewed_at: now,
      reviewed_by: adminCheck.user.id,
      notes,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ age_verified: true, id_verification_status: "approved", id_verified_at: now })
    .eq("id", verification.user_id);

  if (profileError) {
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
