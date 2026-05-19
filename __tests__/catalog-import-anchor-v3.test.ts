import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsv, validateRow } from "@/lib/admin/catalogImport";

/**
 * End-to-end validation pinning the regenerated anchor catalog CSV (v3)
 * against the loosened importer. This test asserts 78/78 rows pass — if it
 * ever drops below 78, either the CSV or the importer drifted.
 *
 * Tests the staging workflow (status=pending_review + empty image_url) is
 * accepted by the importer.
 */

const CSV_PATH = resolve(__dirname, "../.claude/audit/good_hemp_distros_anchor_catalog_import_GHD_v3.csv");

// All categories the v3 CSV references must be present in this map.
// `clothing` has requires_coa=false per production schema (verified GATE-03).
const CATEGORY_REQUIRES_COA_BY_SLUG: Record<string, boolean> = {
  clothing: false,
};

describe("anchor catalog v3 → loosened importer", () => {
  it("parses cleanly (no CSV-shape errors)", () => {
    const csv = readFileSync(CSV_PATH, "utf8");
    const { rows, parseErrors } = parseCsv(csv);
    expect(parseErrors).toEqual([]);
    expect(rows.length).toBe(78);
  });

  it("78/78 rows pass field-level validation against the loosened importer", () => {
    const csv = readFileSync(CSV_PATH, "utf8");
    const { rows } = parseCsv(csv);

    const okCount = rows.filter((r) =>
      validateRow(r, { categoryRequiresCoaBySlug: CATEGORY_REQUIRES_COA_BY_SLUG }).ok
    ).length;

    expect(okCount).toBe(78);
  });

  it("collects no errors when parsed end-to-end (assertion mirrors the API route logic)", () => {
    const csv = readFileSync(CSV_PATH, "utf8");
    const { rows, parseErrors } = parseCsv(csv);
    const allErrors: { rowNumber: number; field: string; message: string }[] = [
      ...parseErrors.map((e) => ({ rowNumber: e.rowNumber, field: "_csv", message: e.message })),
    ];
    for (const row of rows) {
      const result = validateRow(row, { categoryRequiresCoaBySlug: CATEGORY_REQUIRES_COA_BY_SLUG });
      if (!result.ok) allErrors.push(...result.errors);
    }
    expect(allErrors).toEqual([]);
  });

  it("every row uses vendor_id debf6809-dbb4-4987-aabe-60c5fdf7ab49 (DLove Test Vendor)", () => {
    const csv = readFileSync(CSV_PATH, "utf8");
    const { rows } = parseCsv(csv);
    for (const r of rows) {
      expect(r.raw.vendor_id).toBe("debf6809-dbb4-4987-aabe-60c5fdf7ab49");
    }
  });

  it("every row stages as pending_review (hidden from storefront) with empty image_url", () => {
    const csv = readFileSync(CSV_PATH, "utf8");
    const { rows } = parseCsv(csv);
    for (const r of rows) {
      expect(r.raw.status).toBe("pending_review");
      expect(r.raw.image_url).toBe("");
    }
  });

  it("every row attests hemp_derived_attestation=true (apparel IS hemp-derived per spec)", () => {
    const csv = readFileSync(CSV_PATH, "utf8");
    const { rows } = parseCsv(csv);
    for (const r of rows) {
      expect(r.raw.hemp_derived_attestation).toBe("true");
    }
  });

  it("every row maps to product_type=non_intoxicating (apparel)", () => {
    const csv = readFileSync(CSV_PATH, "utf8");
    const { rows } = parseCsv(csv);
    for (const r of rows) {
      expect(r.raw.product_type).toBe("non_intoxicating");
    }
  });
});

describe("loosened importer — image_url status-conditional behavior", () => {
  const base = {
    vendor_id: "debf6809-dbb4-4987-aabe-60c5fdf7ab49",
    name: "Test Apparel",
    price_cents: "5000",
    category_slug: "clothing",
    product_type: "non_intoxicating",
    ship_to_states: "TN",
    hemp_derived_attestation: "true",
  };

  it("ACCEPTS empty image_url when status=pending_review (staging workflow)", () => {
    const result = validateRow(
      { rowNumber: 2, raw: { ...base, image_url: "", status: "pending_review" } },
      { categoryRequiresCoaBySlug: CATEGORY_REQUIRES_COA_BY_SLUG }
    );
    expect(result.ok).toBe(true);
  });

  it("ACCEPTS empty image_url when status omitted (defaults to pending_review)", () => {
    const result = validateRow(
      { rowNumber: 2, raw: { ...base, image_url: "" } },
      { categoryRequiresCoaBySlug: CATEGORY_REQUIRES_COA_BY_SLUG }
    );
    expect(result.ok).toBe(true);
  });

  it("REJECTS empty image_url when status=approved", () => {
    const result = validateRow(
      { rowNumber: 2, raw: { ...base, image_url: "", status: "approved" } },
      { categoryRequiresCoaBySlug: CATEGORY_REQUIRES_COA_BY_SLUG }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "image_url")).toBe(true);
    }
  });

  it("ACCEPTS non-empty valid image_url at any status", () => {
    const pending = validateRow(
      { rowNumber: 2, raw: { ...base, image_url: "https://example.com/x.jpg", status: "pending_review" } },
      { categoryRequiresCoaBySlug: CATEGORY_REQUIRES_COA_BY_SLUG }
    );
    expect(pending.ok).toBe(true);
    const approved = validateRow(
      { rowNumber: 2, raw: { ...base, image_url: "https://example.com/x.jpg", status: "approved" } },
      { categoryRequiresCoaBySlug: CATEGORY_REQUIRES_COA_BY_SLUG }
    );
    expect(approved.ok).toBe(true);
  });

  it("REJECTS malformed image_url (not http(s)) at any status", () => {
    const result = validateRow(
      { rowNumber: 2, raw: { ...base, image_url: "not-a-url", status: "pending_review" } },
      { categoryRequiresCoaBySlug: CATEGORY_REQUIRES_COA_BY_SLUG }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "image_url" && /URL/.test(e.message))).toBe(true);
    }
  });
});
