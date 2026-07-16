import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  DRIVER_DOC_BUCKET,
  DRIVER_DOC_TYPES,
} from "@/lib/drivers/applicationDocs";

/**
 * POST: Step 2 of the driver application — after the browser has uploaded
 * all four documents to storage via the signed URLs from /init, record the
 * application. Verifies each claimed file actually exists (and is
 * non-empty) under the /init upload_id before inserting, so a client
 * can't point the row at paths it never uploaded.
 */
export async function POST(req: NextRequest) {
  const noStore = { "Cache-Control": "no-store" } as const;
  const ref = `ref-${Date.now()}`;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON payload." },
        { status: 400, headers: noStore }
      );
    }

    const text = (key: string) =>
      typeof body[key] === "string" ? (body[key] as string).trim() : "";
    const uploadId = text("upload_id");
    const fullName = text("full_name");
    const email = text("email");
    const phone = text("phone");
    const city = text("city");
    const state = text("state").toUpperCase().slice(0, 2);
    const vehicleType = text("vehicle_type");

    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) {
      return NextResponse.json(
        { error: "Missing or invalid upload session. Please re-attach your documents." },
        { status: 400, headers: noStore }
      );
    }
    if (!fullName || !email || !phone || !city || !state || !vehicleType) {
      return NextResponse.json(
        { error: "Full name, email, phone, city, state, and vehicle type are required." },
        { status: 400, headers: noStore }
      );
    }
    if (
      body.has_valid_license !== true ||
      body.is_21_or_older !== true ||
      body.can_pass_background_check !== true
    ) {
      return NextResponse.json(
        { error: "Please confirm all eligibility requirements." },
        { status: 400, headers: noStore }
      );
    }

    const paths = body.paths as Record<string, unknown> | undefined;
    const prefix = `applications/${uploadId}/`;
    const claimed: Record<string, string> = {};
    for (const docType of DRIVER_DOC_TYPES) {
      const value = paths?.[docType];
      if (typeof value !== "string" || !value.startsWith(prefix)) {
        return NextResponse.json(
          { error: `Document path for ${docType.replace(/_/g, " ")} is missing or invalid. Please re-upload.` },
          { status: 400, headers: noStore }
        );
      }
      claimed[docType] = value;
    }

    // Verify the uploads actually landed (non-empty) under this session.
    const admin = getSupabaseAdminClient();
    const { data: objects, error: listError } = await admin.storage
      .from(DRIVER_DOC_BUCKET)
      .list(`applications/${uploadId}`);
    if (listError) {
      console.error(`[drivers/apply/finalize] ${ref} storage list failed:`, listError.message);
      return NextResponse.json(
        { error: "Could not verify uploaded documents. Please try again.", ref },
        { status: 500, headers: noStore }
      );
    }
    const uploadedByName = new Map(
      (objects || []).map((o) => [o.name, (o.metadata as { size?: number } | null)?.size ?? 0])
    );
    const missing: string[] = [];
    for (const docType of DRIVER_DOC_TYPES) {
      const fileName = claimed[docType].slice(prefix.length);
      const size = uploadedByName.get(fileName);
      if (!size || size <= 0) {
        missing.push(docType.replace(/_/g, " "));
      }
    }
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `These documents didn't finish uploading: ${missing.join(", ")}. Please re-upload and submit again.` },
        { status: 400, headers: noStore }
      );
    }

    const { data: application, error: insertError } = await admin
      .from("driver_applications")
      .insert({
        user_id: user?.id ?? null,
        full_name: fullName,
        email,
        phone,
        city,
        state,
        vehicle_type: vehicleType,
        years_experience: text("years_experience") || null,
        has_valid_license: true,
        is_21_or_older: true,
        can_pass_background_check: true,
        why_drive: text("why_drive") || null,
        license_front_path: claimed.license_front,
        license_back_path: claimed.license_back,
        insurance_path: claimed.insurance,
        registration_path: claimed.registration,
        status: "pending",
      })
      .select("id, status")
      .single();

    if (insertError || !application) {
      console.error(`[drivers/apply/finalize] ${ref} insert failed:`, insertError?.message);
      return NextResponse.json(
        { error: "Failed to save your application. Please try again.", ref },
        { status: 500, headers: noStore }
      );
    }

    return NextResponse.json(
      { success: true, application: { id: application.id, status: application.status } },
      { status: 201, headers: noStore }
    );
  } catch (err) {
    console.error(`[drivers/apply/finalize] ${ref}`, err);
    return NextResponse.json(
      { error: "Internal server error. Please try again.", ref },
      { status: 500, headers: noStore }
    );
  }
}
