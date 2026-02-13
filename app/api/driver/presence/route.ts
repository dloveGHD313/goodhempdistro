import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireApprovedDriver } from "@/lib/server/driverStatusGate";

function requestIdHeaders(requestId: string) {
  return { "X-Request-Id": requestId, "Cache-Control": "no-store" };
}

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized", requestId }, { status: 401, headers: requestIdHeaders(requestId) });
    }

    const gate = await requireApprovedDriver(user.id);
    if (!gate.allowed) {
      return NextResponse.json({ ok: false, ...gate.json, requestId }, { status: gate.status, headers: requestIdHeaders(requestId) });
    }

    const { data: current } = await supabase
      .from("driver_presence")
      .select("driver_id, is_online, notify_offline, lat, lng, location_updated_at, updated_at")
      .eq("driver_id", gate.driverId)
      .maybeSingle();

    if (!current) {
      const { data: created } = await supabase
        .from("driver_presence")
        .insert({ driver_id: gate.driverId, is_online: false, notify_offline: true })
        .select("driver_id, is_online, notify_offline, lat, lng, location_updated_at, updated_at")
        .single();

      return NextResponse.json({ ok: true, requestId, presence: created }, { headers: requestIdHeaders(requestId) });
    }

    return NextResponse.json({ ok: true, requestId, presence: current }, { headers: requestIdHeaders(requestId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Internal server error", requestId }, { status: 500, headers: requestIdHeaders(requestId) });
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized", requestId }, { status: 401, headers: requestIdHeaders(requestId) });
    }

    const gate = await requireApprovedDriver(user.id);
    if (!gate.allowed) {
      return NextResponse.json({ ok: false, ...gate.json, requestId }, { status: gate.status, headers: requestIdHeaders(requestId) });
    }

    const body = (await req.json().catch(() => ({}))) as {
      is_online?: boolean;
      notify_offline?: boolean;
      lat?: number;
      lng?: number;
    };

    const payload: {
      is_online?: boolean;
      notify_offline?: boolean;
      lat?: number | null;
      lng?: number | null;
      location_updated_at?: string;
    } = {};

    if (typeof body.is_online === "boolean") payload.is_online = body.is_online;
    if (typeof body.notify_offline === "boolean") payload.notify_offline = body.notify_offline;
    if (typeof body.lat === "number" && typeof body.lng === "number") {
      payload.lat = body.lat;
      payload.lng = body.lng;
      payload.location_updated_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("driver_presence")
      .upsert({ driver_id: gate.driverId, ...payload }, { onConflict: "driver_id" })
      .select("driver_id, is_online, notify_offline, lat, lng, location_updated_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: "Failed to update presence", requestId }, { status: 500, headers: requestIdHeaders(requestId) });
    }

    return NextResponse.json({ ok: true, requestId, presence: data }, { headers: requestIdHeaders(requestId) });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal server error", requestId }, { status: 500, headers: requestIdHeaders(requestId) });
  }
}
