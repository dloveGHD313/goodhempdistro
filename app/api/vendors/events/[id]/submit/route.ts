import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

/**
 * Submit event for admin review
 * Vendor-only route
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await params;

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, owner_user_id, status")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (eventError) {
      console.error("[vendor-events/submit] Error fetching event:", eventError);
      return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
    }

    if (!event) {
      return NextResponse.json({ error: "Event not found or access denied" }, { status: 404 });
    }

    if (event.status === "pending_review") {
      return NextResponse.json({ error: "Event is already pending review" }, { status: 400 });
    }

    if (event.status === "approved") {
      return NextResponse.json({ error: "Event is already approved" }, { status: 400 });
    }

    const { data: updatedEvent, error: updateError } = await supabase
      .from("events")
      .update({
        status: "pending_review",
        submitted_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", id)
      .select("id, title, status")
      .single();

    if (updateError) {
      console.error("[vendor-events/submit] Error updating event:", updateError);
      return NextResponse.json({ error: "Failed to submit event" }, { status: 500 });
    }

    revalidatePath("/vendors/events");
    revalidatePath("/admin/events");

    return NextResponse.json(
      { success: true, event: updatedEvent, message: "Event submitted for review" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[vendor-events/submit] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
