import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClientOrThrow } from "@/lib/supabaseAdmin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", id)
    .in("status", ["approved", "published"])
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ interested: 0, going: 0 }, { status: 404 });
  }

  let admin;
  try {
    admin = getSupabaseAdminClientOrThrow();
  } catch (error) {
    console.error("[events/engagement/counts] Admin client error:", error);
    return NextResponse.json({ error: "Unable to fetch counts" }, { status: 500 });
  }

  const { count: interestedCount } = await admin
    .from("event_engagements")
    .select("*", { count: "exact", head: true })
    .eq("event_id", id)
    .eq("status", "interested");

  const { count: goingCount } = await admin
    .from("event_engagements")
    .select("*", { count: "exact", head: true })
    .eq("event_id", id)
    .eq("status", "going");

  return NextResponse.json({
    interested: interestedCount || 0,
    going: goingCount || 0,
  });
}
