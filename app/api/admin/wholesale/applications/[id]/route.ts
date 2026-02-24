import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdminUsers } from "@/lib/auth/requireAdminUsers";

const VALID_STATUSES = ["approved", "rejected"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdminUsers(req);
  if (!adminCheck.user || !adminCheck.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body?.status as string | undefined;
  const notes = typeof body?.notes === "string" ? body.notes : undefined;

  const updates: Record<string, unknown> = {};
  if (status) {
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = status;
    updates.reviewed_at = new Date().toISOString();
    updates.reviewed_by = adminCheck.user.id;
  }
  if (notes !== undefined) {
    updates.notes = notes;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: application, error: fetchError } = await admin
    .from("wholesale_applications")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (fetchError || !application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const { error: updateError } = await admin
    .from("wholesale_applications")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    console.error("[admin/wholesale/applications] update error", updateError);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }

  if (status === "approved") {
    const { data: profile } = await admin
      .from("profiles")
      .select("roles")
      .eq("id", application.user_id)
      .single();

    const currentRoles: string[] = Array.isArray(profile?.roles) ? profile.roles : [];
    if (!currentRoles.includes("wholesale")) {
      const newRoles = [...currentRoles, "wholesale"];
      const { error: profileError } = await admin
        .from("profiles")
        .update({ roles: newRoles })
        .eq("id", application.user_id);
      if (profileError) {
        console.error("[admin/wholesale/applications] profile roles update error", profileError);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
