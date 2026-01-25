import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { revalidatePath } from "next/cache";

/**
 * Reject event (admin only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  const logStage = (stage: string, details?: Record<string, unknown>) => {
    console.log(`[admin/events/reject][${requestId}] ${stage}`, details || {});
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
    const { reason } = await req.json();
    logStage("payload", { keys: ["reason"], hasReason: Boolean(reason) });

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { ok: false, error: "Rejection reason is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = createSupabaseAdminClient();

    logStage("fetch_event", { eventId: id });
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, title, status")
      .eq("id", id)
      .maybeSingle();

    if (eventError || !event) {
      if (eventError) {
        console.error(`[admin/events/reject][${requestId}] event_fetch_error`, {
          code: eventError.code,
          message: eventError.message,
          details: eventError.details,
          hint: eventError.hint,
        });
      }
      return NextResponse.json(
        { ok: false, error: "Event not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (event.status !== "pending_review") {
      return NextResponse.json(
        { ok: false, error: `Event is not pending review (current status: ${event.status})` },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const baseUpdate = {
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminCheck.user.id,
      rejection_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    };

    logStage("update_attempt", { keys: Object.keys(baseUpdate) });
    let updatedEvent: any = null;
    let updateError: any = null;
    const initialUpdate = await admin
      .from("events")
      .update(baseUpdate)
      .eq("id", id)
      .select("id, title, status, rejection_reason")
      .single();
    updatedEvent = initialUpdate.data;
    updateError = initialUpdate.error;

    if (updateError && /column .* does not exist/i.test(updateError.message || "")) {
      console.warn(`[admin/events/reject][${requestId}] column_missing_retry`, {
        message: updateError.message,
      });
      const retry = await admin
        .from("events")
        .update({ status: "rejected" })
        .eq("id", id)
        .select("id, title, status")
        .single();
      updatedEvent = retry.data;
      updateError = retry.error;
      logStage("retry_result", { keys: ["status"], ok: !updateError });
    }

    if (updateError) {
      console.error(`[admin/events/reject][${requestId}] update_error`, {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to reject event",
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    revalidatePath("/admin/events");
    revalidatePath("/vendors/events");
    revalidatePath("/events");

    return NextResponse.json(
      {
        ok: true,
        data: updatedEvent,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error(`[admin/events/reject][${requestId}] unexpected_error`, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
