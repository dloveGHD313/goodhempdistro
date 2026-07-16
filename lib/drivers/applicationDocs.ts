/**
 * Driver application document validation (shop brief 2026-07-14 P2).
 *
 * The insurance-upload failure had three compounding causes:
 * 1. The form's insurance/registration inputs were accept=".pdf" only — a
 *    phone photo (JPG/PNG) of an insurance card couldn't be selected.
 * 2. The browser uploaded straight to storage with upsert:true, which needs
 *    an UPDATE storage policy the bucket doesn't grant (INSERT only).
 * 3. uploadFile() swallowed the error and showed a generic retry message.
 *
 * 2026-07-14 follow-up: the first fix (#214) funneled all four files into
 * one multipart POST to a Vercel function — the platform rejects bodies
 * over 4.5MB at the edge (413, function never runs), which four phone
 * photos exceed immediately. Flow is now signed upload URLs
 * (/api/drivers/apply/init → browser uploads straight to Supabase Storage
 * → /api/drivers/apply/finalize). This module holds the pure, unit-tested
 * validation shared by init.
 */

export const DRIVER_DOC_BUCKET = "driver-documents";

export const DRIVER_DOC_TYPES = [
  "license_front",
  "license_back",
  "insurance",
  "registration",
] as const;
export type DriverDocType = (typeof DRIVER_DOC_TYPES)[number];

export const DRIVER_DOC_MAX_BYTES = 10 * 1024 * 1024; // 10MB

/** PDF + common image formats — insurance cards are usually phone photos. */
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type DocValidation =
  | { ok: true; ext: string }
  | { ok: false; reason: string };

/** Pure — unit-tested. */
export function validateDriverDocFile(file: {
  type?: string | null;
  size: number;
}): DocValidation {
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return {
      ok: false,
      reason: "File must be a PDF, JPG, PNG, or WebP image.",
    };
  }
  if (file.size <= 0) {
    return { ok: false, reason: "File is empty." };
  }
  if (file.size > DRIVER_DOC_MAX_BYTES) {
    return { ok: false, reason: "File is too large (10MB max)." };
  }
  return { ok: true, ext: MIME_TO_EXT[mime] };
}

/** Storage path for a doc: applications/{applicationId}/{docType}.{ext} */
export function driverDocStoragePath(
  applicationId: string,
  docType: DriverDocType,
  ext: string
): string {
  return `applications/${applicationId}/${docType}.${ext}`;
}
