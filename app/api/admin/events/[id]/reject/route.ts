import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";

/**
 * Reject event (admin only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { user, profile } = await getCurrentUserProfile(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(profile)) {
      return NextResponse.json({ error: "Forbidden: Not an admin" }, { status: 403 });
    }

    const { id } = await params;
    const { reason } = await req.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, title, status")
      .eq("id", id)
      .maybeSingle();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status !== "pending_review") {
      return NextResponse.json(
        { error: `Event is not pending review (current status: ${event.status})` },
        { status: 400 }
      );
    }

    const baseUpdate = {
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      rejection_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    };

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

    if (
      updateError &&
      /column .* does not exist/i.test(updateError.message || "")
    ) {
      console.warn("[admin/events/reject] Column missing, retrying with status only.");
      const retry = await admin
        .from("events")
        .update({ status: "rejected" })
        .eq("id", id)
        .select("id, title, status")
        .single();
      updatedEvent = retry.data;
      updateError = retry.error;
    }

    if (updateError) {
      console.error("[admin/events/reject] Error updating event:", updateError);
      return NextResponse.json({ error: "Failed to reject event" }, { status: 500 });
    }

    revalidatePath("/admin/events");
    revalidatePath("/vendors/events");
    revalidatePath("/events");

    return NextResponse.json({
      success: true,
      event: updatedEvent,
    });
  } catch (error) {
    console.error("[admin/events/reject] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
