import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  DRIVER_DOC_BUCKET,
  DRIVER_DOC_TYPES,
  driverDocStoragePath,
  validateDriverDocFile,
  type DriverDocType,
} from "@/lib/drivers/applicationDocs";

/**
 * POST: Driver application with document uploads (shop brief 2026-07-14 P2).
 *
 * Replaces the browser-direct storage upload from /logistics/apply, which
 * failed silently (upsert:true without an UPDATE storage policy) and only
 * accepted PDFs for insurance/registration. Uploads run server-side with
 * the service role — no storage RLS ambiguity — and every failure returns
 * a specific message the form can show. Guest applications allowed (same
 * as before: driver_applications.user_id nullable).
 *
 * multipart/form-data: full_name, email, phone, city, state, vehicle_type,
 * years_experience, has_valid_license, is_21_or_older,
 * can_pass_background_check, why_drive?, and files license_front,
 * license_back, insurance, registration (PDF/JPG/PNG/WebP, 10MB max each).
 */
export async function POST(req: NextRequest) {
  const ref = `ref-${Date.now()}`;
  const noStore = { "Cache-Control": "no-store" } as const;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with document files." },
        { status: 400, headers: noStore }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const formData = await req.formData();
    const text = (key: string) => {
      const value = formData.get(key);
      return typeof value === "string" ? value.trim() : "";
    };
    const bool = (key: string) => text(key) === "true";

    const fullName = text("full_name");
    const email = text("email");
    const phone = text("phone");
    const city = text("city");
    const state = text("state").toUpperCase().slice(0, 2);
    const vehicleType = text("vehicle_type");
    const yearsExperience = text("years_experience");

    if (!fullName || !email || !phone || !city || !state || !vehicleType) {
      return NextResponse.json(
        { error: "Full name, email, phone, city, state, and vehicle type are required." },
        { status: 400, headers: noStore }
      );
    }
    if (!bool("has_valid_license") || !bool("is_21_or_older") || !bool("can_pass_background_check")) {
      return NextResponse.json(
        { error: "Please confirm all eligibility requirements." },
        { status: 400, headers: noStore }
      );
    }

    // Validate all four documents up front — report every problem at once.
    const files: Partial<Record<DriverDocType, { file: File; ext: string }>> = {};
    const docErrors: string[] = [];
    for (const docType of DRIVER_DOC_TYPES) {
      const file = formData.get(docType);
      if (!(file instanceof File) || file.size === 0) {
        docErrors.push(`${docType.replace(/_/g, " ")} is required`);
        continue;
      }
      const validation = validateDriverDocFile({ type: file.type, size: file.size });
      if (!validation.ok) {
        docErrors.push(`${docType.replace(/_/g, " ")}: ${validation.reason}`);
        continue;
      }
      files[docType] = { file, ext: validation.ext };
    }
    if (docErrors.length > 0) {
      return NextResponse.json(
        { error: docErrors.join(". "), errors: docErrors },
        { status: 400, headers: noStore }
      );
    }

    const admin = getSupabaseAdminClient();

    // Create the application first so document paths key off its id;
    // clean everything up if any later step fails.
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
        years_experience: yearsExperience || null,
        has_valid_license: true,
        is_21_or_older: true,
        can_pass_background_check: true,
        why_drive: text("why_drive") || null,
        status: "pending",
      })
      .select("id, status")
      .single();

    if (insertError || !application) {
      console.error(`[drivers/apply-with-docs] ${ref} insert failed:`, insertError?.message);
      return NextResponse.json(
        { error: "Failed to create application. Please try again.", ref },
        { status: 500, headers: noStore }
      );
    }

    const uploadedPaths: string[] = [];
    const cleanup = async () => {
      if (uploadedPaths.length > 0) {
        await admin.storage.from(DRIVER_DOC_BUCKET).remove(uploadedPaths);
      }
      await admin.from("driver_applications").delete().eq("id", application.id);
    };

    const pathByDoc: Partial<Record<DriverDocType, string>> = {};
    for (const docType of DRIVER_DOC_TYPES) {
      const entry = files[docType]!;
      const path = driverDocStoragePath(application.id, docType, entry.ext);
      const buf = await entry.file.arrayBuffer();
      const { error: uploadError } = await admin.storage
        .from(DRIVER_DOC_BUCKET)
        .upload(path, buf, {
          contentType: entry.file.type || "application/octet-stream",
          upsert: true,
        });
      if (uploadError) {
        console.error(`[drivers/apply-with-docs] ${ref} upload failed (${docType}):`, uploadError.message);
        await cleanup();
        return NextResponse.json(
          { error: `Failed to upload ${docType.replace(/_/g, " ")}. Please try again.`, ref },
          { status: 500, headers: noStore }
        );
      }
      uploadedPaths.push(path);
      pathByDoc[docType] = path;
    }

    const { error: updateError } = await admin
      .from("driver_applications")
      .update({
        license_front_path: pathByDoc.license_front,
        license_back_path: pathByDoc.license_back,
        insurance_path: pathByDoc.insurance,
        registration_path: pathByDoc.registration,
      })
      .eq("id", application.id);

    if (updateError) {
      console.error(`[drivers/apply-with-docs] ${ref} path update failed:`, updateError.message);
      await cleanup();
      return NextResponse.json(
        { error: "Failed to save document records. Please try again.", ref },
        { status: 500, headers: noStore }
      );
    }

    return NextResponse.json(
      { success: true, application: { id: application.id, status: application.status } },
      { status: 201, headers: noStore }
    );
  } catch (err) {
    console.error(`[drivers/apply-with-docs] ${ref}`, err);
    return NextResponse.json(
      { error: "Internal server error. Please try again.", ref },
      { status: 500, headers: noStore }
    );
  }
}
