import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

const REQUIRED_DOC_TYPES = ["driver_license", "vehicle_registration", "insurance"] as const;
const BUCKET = "driver_documents";

function parseDate(value: unknown): Date | null {
  if (value == null) return null;
  const s = typeof value === "string" ? value.trim() : String(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function isFutureDate(d: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d > today;
}

/**
 * POST: Submit on-demand driver application WITH required compliance documents.
 * Accepts multipart/form-data: full_name, email, phone, service_area, vehicle_type, notes,
 * driver_license (file), driver_license_expires (date),
 * vehicle_registration (file), vehicle_registration_expires (date),
 * insurance (file), insurance_expires (date).
 * Blocks submit if any required doc missing or expires_at in the past.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { code: "DOCUMENTS_REQUIRED", message: "Compliance documents required. Use the application form with document uploads." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const formData = await req.formData();
    const full_name = (formData.get("full_name") as string)?.trim() ?? "";
    const email = (formData.get("email") as string)?.trim() ?? "";
    const phone = (formData.get("phone") as string)?.trim() || null;
    const service_area = (formData.get("service_area") as string)?.trim() || null;
    const vehicle_type = (formData.get("vehicle_type") as string)?.trim() || null;
    const notes = (formData.get("notes") as string)?.trim() || null;

    if (!full_name || !email) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Full name and email are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = getSupabaseAdminClient();
    const errors: string[] = [];

    const docs: { doc_type: (typeof REQUIRED_DOC_TYPES)[number]; file: File; expires_at: Date }[] = [];
    for (const doc_type of REQUIRED_DOC_TYPES) {
      const file = formData.get(doc_type) as File | null;
      const expiresVal = formData.get(`${doc_type}_expires`);
      const expires_at = parseDate(expiresVal);
      if (!file || file.size === 0) {
        errors.push(`${doc_type.replace("_", " ")} is required`);
        continue;
      }
      if (!expires_at) {
        errors.push(`${doc_type.replace("_", " ")} expiry date is required`);
        continue;
      }
      if (!isFutureDate(new Date(expires_at))) {
        errors.push(`${doc_type.replace("_", " ")} has already expired`);
        continue;
      }
      docs.push({ doc_type, file, expires_at });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { code: "DOCUMENT_VALIDATION", message: errors.join(". "), errors },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: row, error: insertError } = await admin
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

    if (insertError || !row) {
      console.warn("[logistics/apply/on-demand-driver-with-docs] insert error", insertError?.message);
      return NextResponse.json(
        { code: "SUBMIT_FAILED", message: "Failed to submit application" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const applicationId = row.id;
    for (const { doc_type, file, expires_at } of docs) {
      const ext = file.name?.split(".").pop()?.slice(0, 6) || "pdf";
      const path = `${applicationId}/${doc_type}.${ext}`;
      const buf = await file.arrayBuffer();
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
      if (uploadError) {
        console.warn("[logistics/apply/on-demand-driver-with-docs] upload error", doc_type, uploadError.message);
        await admin.from("logistics_applications").delete().eq("id", applicationId);
        return NextResponse.json(
          { code: "UPLOAD_FAILED", message: `Failed to upload ${doc_type.replace("_", " ")}` },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
      const { error: docError } = await admin.from("driver_documents").insert({
        application_id: applicationId,
        doc_type,
        file_path: path,
        expires_at: expires_at.toISOString().slice(0, 10),
        status: "pending",
      });
      if (docError) {
        console.warn("[logistics/apply/on-demand-driver-with-docs] doc insert error", docError.message);
        await admin.from("logistics_applications").delete().eq("id", applicationId);
        return NextResponse.json(
          { code: "SUBMIT_FAILED", message: "Failed to save document record" },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    return NextResponse.json(
      { success: true, application: { id: row.id, status: row.status } },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.warn("[logistics/apply/on-demand-driver-with-docs]", err);
    return NextResponse.json(
      { code: "SUBMIT_FAILED", message: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
