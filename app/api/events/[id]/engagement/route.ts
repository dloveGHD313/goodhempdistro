import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

const allowedStatuses = new Set(["interested", "going"]);

async function ensureEventVisible(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string
) {
  const { data: event } = await supabase
    .from("events")
    .select("id, vendor_id, status")
    .eq("id", eventId)
    .in("status", ["approved", "published"])
    .maybeSingle();

  if (!event?.vendor_id) {
    return false;
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("id", event.vendor_id)
    .eq("is_active", true)
    .eq("is_approved", true)
    .maybeSingle();

  return !!vendor;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: null });
  }

  const { id } = await params;

  const { data } = await supabase
    .from("event_engagements")
    .select("status")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ status: data?.status || null });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await req.json();
  const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "";

  if (!allowedStatuses.has(normalizedStatus)) {
    return NextResponse.json({ error: "Invalid engagement status" }, { status: 400 });
  }

  const isVisible = await ensureEventVisible(supabase, id);
  if (!isVisible) {
    return NextResponse.json({ error: "Event not available" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("event_engagements")
    .upsert(
      { user_id: user.id, event_id: id, status: normalizedStatus },
      { onConflict: "user_id,event_id" }
    )
    .select("status")
    .single();

  if (error) {
    console.error("[events/engagement] Error updating engagement:", error);
    return NextResponse.json({ error: "Failed to update engagement" }, { status: 500 });
  }

  return NextResponse.json({ status: data?.status || normalizedStatus });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from("event_engagements")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", id);

  if (error) {
    console.error("[events/engagement] Error deleting engagement:", error);
    return NextResponse.json({ error: "Failed to remove engagement" }, { status: 500 });
  }

  return NextResponse.json({ status: null });
}
