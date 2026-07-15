import { describe, expect, it } from "vitest";
import {
  DRIVER_DOC_MAX_BYTES,
  driverDocStoragePath,
  validateDriverDocFile,
} from "@/lib/drivers/applicationDocs";

/**
 * P2 regression contract (shop brief 2026-07-14): a driver applicant can
 * upload PDF/JPG/PNG insurance docs. The old form only accepted .pdf for
 * insurance/registration and swallowed storage errors — no application
 * ever landed with an insurance doc.
 */

describe("validateDriverDocFile", () => {
  it("accepts PDF, JPG, PNG, and WebP (the regression: JPG/PNG insurance photos)", () => {
    expect(validateDriverDocFile({ type: "application/pdf", size: 1000 }).ok).toBe(true);
    expect(validateDriverDocFile({ type: "image/jpeg", size: 1000 }).ok).toBe(true);
    expect(validateDriverDocFile({ type: "image/png", size: 1000 }).ok).toBe(true);
    expect(validateDriverDocFile({ type: "image/webp", size: 1000 }).ok).toBe(true);
  });

  it("rejects disallowed types with a specific reason", () => {
    for (const type of ["application/x-msdownload", "text/html", "", null]) {
      const result = validateDriverDocFile({ type, size: 1000 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/PDF, JPG, PNG/);
    }
  });

  it("rejects empty and oversized files", () => {
    expect(validateDriverDocFile({ type: "image/jpeg", size: 0 }).ok).toBe(false);
    expect(
      validateDriverDocFile({ type: "image/jpeg", size: DRIVER_DOC_MAX_BYTES + 1 }).ok
    ).toBe(false);
    expect(
      validateDriverDocFile({ type: "image/jpeg", size: DRIVER_DOC_MAX_BYTES }).ok
    ).toBe(true);
  });

  it("maps MIME to a canonical extension (never trusts the filename)", () => {
    const jpeg = validateDriverDocFile({ type: "image/jpeg", size: 10 });
    expect(jpeg.ok && jpeg.ext).toBe("jpg");
    const pdf = validateDriverDocFile({ type: "application/pdf", size: 10 });
    expect(pdf.ok && pdf.ext).toBe("pdf");
  });
});

describe("driverDocStoragePath", () => {
  it("keys documents under the application id for admin review", () => {
    expect(driverDocStoragePath("abc-123", "insurance", "jpg")).toBe(
      "applications/abc-123/insurance.jpg"
    );
  });
});
