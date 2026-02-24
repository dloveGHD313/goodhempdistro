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

  if (!status || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: "Invalid or missing status" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: application, error: fetchError } = await admin
    .from("wholesale_applications")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (fetchError || !application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (application.status === "approved") {
    return NextResponse.json({ error: "Application already approved" }, { status: 400 });
  }

  if (status === "approved") {
    // Step 1: Grant wholesale role FIRST (atomic: fail fast if role grant fails)
    const { data: profile, error: profileFetchError } = await admin
      .from("profiles")
      .select("roles")
      .eq("id", application.user_id)
      .single();

    if (profileFetchError || !profile) {
      return NextResponse.json(
        { ok: false, error: "Failed to load applicant profile", detail: profileFetchError?.message },
        { status: 500 }
      );
    }

    const currentRoles: string[] = Array.isArray(profile.roles) ? profile.roles : [];
    const normalized = currentRoles.map((r) => (typeof r === "string" ? r.trim().toLowerCase() : "")).filter(Boolean);
    const newRoles = [...new Set([...normalized, "wholesale"])];

    const { error: profileError } = await admin
      .from("profiles")
      .update({ roles: newRoles })
      .eq("id", application.user_id);

    if (profileError) {
      return NextResponse.json(
        { ok: false, error: "Failed to grant wholesale role", detail: profileError.message },
        { status: 500 }
      );
    }

    // Step 2: Mark application approved (role already granted)
    const updates = {
      status: "approved" as const,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminCheck.user.id,
      ...(notes !== undefined ? { notes } : {}),
    };

    const { error: updateError } = await admin
      .from("wholesale_applications")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      console.error("[admin/wholesale/applications] application status update failed after role grant", updateError);
      return NextResponse.json(
        {
          ok: false,
          error: "Role granted but application status update failed — manual review required",
          detail: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  // Reject: only update application
  const updates = {
    status: "rejected" as const,
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminCheck.user.id,
    ...(notes !== undefined ? { notes } : {}),
  };

  const { error: updateError } = await admin.from("wholesale_applications").update(updates).eq("id", id);

  if (updateError) {
    console.error("[admin/wholesale/applications] reject update error", updateError);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
