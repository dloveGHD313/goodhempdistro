import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  DRIVER_DOC_BUCKET,
  DRIVER_DOC_TYPES,
  driverDocStoragePath,
  validateDriverDocFile,
} from "@/lib/drivers/applicationDocs";

/**
 * POST: Step 1 of the driver application — issue signed upload URLs.
 *
 * Why signed URLs (2026-07-14 follow-up to #214): the multipart endpoint
 * routed all four documents through one serverless request, and Vercel
 * rejects bodies over 4.5MB at the edge (413, function never runs) — four
 * phone photos exceed that immediately, which is why runtime logs showed
 * ZERO POSTs. File bytes now go browser → Supabase Storage directly via
 * per-path signed upload URLs; only small JSON hits Vercel.
 *
 * Body: { docs: [{ doc_type, mime, size }] } — must cover all four doc
 * types. Validates MIME/size up front so the user gets every problem at
 * once, then returns { upload_id, uploads: { [doc_type]: { path, token } } }.
 */
export async function POST(req: NextRequest) {
  const noStore = { "Cache-Control": "no-store" } as const;
  try {
    const body = await req.json().catch(() => null);
    const docs = Array.isArray(body?.docs) ? body.docs : null;
    if (!docs) {
      return NextResponse.json(
        { error: "Expected { docs: [{ doc_type, mime, size }] }." },
        { status: 400, headers: noStore }
      );
    }

    const byType = new Map<string, { mime: string; size: number }>();
    for (const doc of docs) {
      if (doc && typeof doc.doc_type === "string") {
        byType.set(doc.doc_type, {
          mime: typeof doc.mime === "string" ? doc.mime : "",
          size: typeof doc.size === "number" ? doc.size : 0,
        });
      }
    }

    const errors: string[] = [];
    const validated: Array<{ docType: (typeof DRIVER_DOC_TYPES)[number]; ext: string }> = [];
    for (const docType of DRIVER_DOC_TYPES) {
      const meta = byType.get(docType);
      if (!meta) {
        errors.push(`${docType.replace(/_/g, " ")} is required`);
        continue;
      }
      const validation = validateDriverDocFile({ type: meta.mime, size: meta.size });
      if (!validation.ok) {
        errors.push(`${docType.replace(/_/g, " ")}: ${validation.reason}`);
        continue;
      }
      validated.push({ docType, ext: validation.ext });
    }
    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.join(". "), errors },
        { status: 400, headers: noStore }
      );
    }

    const admin = getSupabaseAdminClient();
    const uploadId = crypto.randomUUID();
    const uploads: Record<string, { path: string; token: string }> = {};
    for (const { docType, ext } of validated) {
      const path = driverDocStoragePath(uploadId, docType, ext);
      const { data, error } = await admin.storage
        .from(DRIVER_DOC_BUCKET)
        .createSignedUploadUrl(path);
      if (error || !data?.token) {
        console.error("[drivers/apply/init] signed URL failed:", docType, error?.message);
        return NextResponse.json(
          { error: `Could not prepare the ${docType.replace(/_/g, " ")} upload. Please try again.` },
          { status: 500, headers: noStore }
        );
      }
      uploads[docType] = { path, token: data.token };
    }

    return NextResponse.json(
      { upload_id: uploadId, bucket: DRIVER_DOC_BUCKET, uploads },
      { headers: noStore }
    );
  } catch (err) {
    console.error("[drivers/apply/init]", err);
    return NextResponse.json(
      { error: "Internal server error preparing uploads. Please try again." },
      { status: 500, headers: noStore }
    );
  }
}
