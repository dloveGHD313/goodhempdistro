import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const VALID_STATUSES = ["new", "replied", "closed"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const logStage = (stage: string, details?: Record<string, unknown>) => {
    console.log(`[admin/inquiries][${requestId}] ${stage}`, details || {});
  };
  try {
    logStage("start");
    const adminCheck = await requireAdmin();
    if (!adminCheck.user) {
      logStage("auth_missing", { reason: adminCheck.reason });
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (!adminCheck.isAdmin) {
      logStage("auth_forbidden", { userId: adminCheck.user.id, reason: adminCheck.reason });
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = body?.status as string | undefined;
    const vendorNote = typeof body?.vendor_note === "string" ? body.vendor_note : undefined;

    const updates: Record<string, unknown> = {};
    if (status) {
      if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
        return NextResponse.json(
          { ok: false, error: "Invalid status" },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }
      updates.status = status;
    }
    if (vendorNote !== undefined) {
      updates.vendor_note = vendorNote;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No fields to update" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    updates.updated_at = new Date().toISOString();

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("service_inquiries")
      .update(updates)
      .eq("id", id)
      .select("id, status, vendor_note, updated_at")
      .single();

    if (error) {
      console.error(`[admin/inquiries][${requestId}] update_error`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { ok: false, error: "Failed to update inquiry", message: error.message, details: error.details, hint: error.hint },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    logStage("updated", { inquiryId: id, keys: Object.keys(updates) });
    return NextResponse.json(
      { ok: true, data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[admin/inquiries][${requestId}] unexpected_error`, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
