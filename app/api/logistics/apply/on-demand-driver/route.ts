import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireHumanFromRequest } from "@/lib/server/turnstile";

/**
 * POST: Submit on-demand driver application (logistics_applications type=on_demand_driver).
 * Does not require authentication; applicant may not have an account.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Human verification (Cloudflare Turnstile) — no-op until keys are set.
    const humanError = await requireHumanFromRequest(req, body);
    if (humanError) {
      return NextResponse.json({ error: humanError }, { status: 403 });
    }

    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : null;
    const service_area = typeof body.service_area === "string" ? body.service_area.trim() : null;
    const vehicle_type = typeof body.vehicle_type === "string" ? body.vehicle_type.trim() : null;
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;

    if (!full_name || !email) {
      return NextResponse.json(
        { error: "Full name and email are required" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("logistics_applications")
      .insert({
        type: "on_demand_driver",
        full_name,
        email,
        phone: phone || null,
        service_area: service_area || null,
        vehicle_type: vehicle_type || null,
        notes: notes || null,
        status: "pending",
      })
      .select("id, status, created_at")
      .single();

    if (error) {
      console.error("[logistics/apply/on-demand-driver] insert error", error.message);
      return NextResponse.json(
        { error: "Failed to submit application" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, application: { id: row.id, status: row.status } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[logistics/apply/on-demand-driver]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
