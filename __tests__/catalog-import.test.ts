import { describe, it, expect } from "vitest";
import { parseCsv, validateRow, CSV_TEMPLATE_HEADERS } from "@/lib/admin/catalogImport";

const VALID_VENDOR = "24a1bd8e-dbd8-484c-9c3a-b004f4e9588f";

const categoryRequiresCoaBySlug: Record<string, boolean> = {
  clothing: false,
  tinctures: true,
  edibles: true,
  "delta-8": true,
};

const baseRow = {
  vendor_id: VALID_VENDOR,
  name: "Test Product",
  description: "A test product",
  price_cents: "4999",
  category_slug: "tinctures",
  product_type: "non_intoxicating",
  image_url: "https://example.supabase.co/storage/v1/object/public/product-images/x.jpg",
  coa_url: "https://example.supabase.co/storage/v1/object/public/coas/x.pdf",
  ship_to_states: "CA,CO,OR",
  status: "pending_review",
  hemp_derived_attestation: "true",
  delta8_disclaimer_ack: "",
};

const buildRow = (overrides: Partial<typeof baseRow> = {}) => ({
  rowNumber: 2,
  raw: { ...baseRow, ...overrides },
});

describe("parseCsv", () => {
  it("parses a minimal valid CSV with header + one row", () => {
    const csv = `vendor_id,name,price_cents\n${VALID_VENDOR},Tincture,4999`;
    const { rows, parseErrors } = parseCsv(csv);
    expect(parseErrors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].raw.name).toBe("Tincture");
    expect(rows[0].raw.price_cents).toBe("4999");
  });

  it("handles quoted fields with commas", () => {
    const csv = `name,description\n"Product A","Premium, full-spectrum tincture"`;
    const { rows } = parseCsv(csv);
    expect(rows[0].raw.description).toBe("Premium, full-spectrum tincture");
  });

  it("handles escaped double-quotes inside quoted fields", () => {
    const csv = `name,description\n"X","She said ""hi"" today"`;
    const { rows } = parseCsv(csv);
    expect(rows[0].raw.description).toBe('She said "hi" today');
  });

  it("strips UTF-8 BOM", () => {
    const csv = `﻿name\nA`;
    const { rows } = parseCsv(csv);
    expect(rows[0].raw.name).toBe("A");
  });

  it("skips blank lines", () => {
    const csv = `name\nA\n\nB\n`;
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.raw.name)).toEqual(["A", "B"]);
  });

  it("returns parseError when CSV is empty", () => {
    const { rows, parseErrors } = parseCsv("");
    expect(rows).toHaveLength(0);
    expect(parseErrors[0].message).toMatch(/empty/i);
  });

  it("flags column-count mismatch but still emits the row", () => {
    const csv = `a,b,c\n1,2`;
    const { rows, parseErrors } = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(parseErrors.some((e) => /column count mismatch/i.test(e.message))).toBe(true);
  });
});

describe("validateRow — required fields", () => {
  it("accepts a valid row", () => {
    const result = validateRow(buildRow(), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(true);
  });

  it("rejects missing vendor_id", () => {
    const result = validateRow(buildRow({ vendor_id: "" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "vendor_id")).toBe(true);
    }
  });

  it("rejects non-UUID vendor_id", () => {
    const result = validateRow(buildRow({ vendor_id: "not-a-uuid" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /must be a UUID/i.test(e.message))).toBe(true);
    }
  });

  it("rejects missing name", () => {
    const result = validateRow(buildRow({ name: "" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
    }
  });

  it("rejects price_cents = 0", () => {
    const result = validateRow(buildRow({ price_cents: "0" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /price_cents must be > 0/i.test(e.message))).toBe(true);
    }
  });

  it("rejects non-numeric price_cents", () => {
    const result = validateRow(buildRow({ price_cents: "abc" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "price_cents")).toBe(true);
    }
  });

  it("rejects unknown category_slug", () => {
    const result = validateRow(buildRow({ category_slug: "mystery" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /not found in categories table/i.test(e.message))).toBe(true);
    }
  });

  it("rejects invalid product_type", () => {
    const result = validateRow(buildRow({ product_type: "recreational" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "product_type")).toBe(true);
    }
  });

  // PR #189: image_url is required only when status === "approved".
  // Staged rows (default status pending_review) may omit it — this is the
  // anchor-catalog workflow: import hidden SKUs now, add photos later.
  it("accepts missing image_url when row is staged (default pending_review)", () => {
    const result = validateRow(buildRow({ image_url: "" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(true);
  });

  it("rejects missing image_url when status=approved (would be publicly visible)", () => {
    const result = validateRow(buildRow({ image_url: "", status: "approved" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "image_url")).toBe(true);
    }
  });

  it("rejects non-URL image_url", () => {
    const result = validateRow(buildRow({ image_url: "not-a-url" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /image_url must be an http/i.test(e.message))).toBe(true);
    }
  });
});

describe("validateRow — ship_to_states", () => {
  it("rejects empty ship_to_states", () => {
    const result = validateRow(buildRow({ ship_to_states: "" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "ship_to_states")).toBe(true);
    }
  });

  it("rejects invalid state codes (longer than 2 chars)", () => {
    // Validator uppercases first then checks ^[A-Z]{2}$, so "California" → "CALIFORNIA" → rejected.
    const result = validateRow(buildRow({ ship_to_states: "CA,XX,California" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const stateErr = result.errors.find((e) => e.field === "ship_to_states");
      expect(stateErr?.message).toMatch(/CALIFORNIA/);
    }
  });

  it("uppercases and trims state codes", () => {
    const result = validateRow(buildRow({ ship_to_states: " ca , co " }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ship_to_states).toEqual(["CA", "CO"]);
    }
  });
});

describe("validateRow — COA requirement varies by category", () => {
  it("requires coa_url when category.requires_coa = true", () => {
    const result = validateRow(buildRow({ category_slug: "tinctures", coa_url: "" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const coaErr = result.errors.find((e) => e.field === "coa_url");
      expect(coaErr).toBeDefined();
      expect(coaErr?.message).toMatch(/requires_coa=true/i);
    }
  });

  it("does NOT require coa_url when category.requires_coa = false (e.g. clothing)", () => {
    const result = validateRow(
      buildRow({ category_slug: "clothing", coa_url: "", product_type: "non_intoxicating" }),
      { categoryRequiresCoaBySlug },
    );
    expect(result.ok).toBe(true);
  });

  it("accepts optional coa_url for non-required category if URL is valid", () => {
    const result = validateRow(
      buildRow({ category_slug: "clothing", coa_url: "https://example.com/coa.pdf" }),
      { categoryRequiresCoaBySlug },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.coa_url).toMatch(/coa.pdf$/);
  });
});

describe("validateRow — delta8 disclaimer", () => {
  it("requires delta8_disclaimer_ack=true when product_type=delta8", () => {
    const result = validateRow(
      buildRow({ product_type: "delta8", category_slug: "delta-8", delta8_disclaimer_ack: "" }),
      { categoryRequiresCoaBySlug },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "delta8_disclaimer_ack")).toBe(true);
    }
  });

  it("accepts delta8 row when delta8_disclaimer_ack=true", () => {
    const result = validateRow(
      buildRow({ product_type: "delta8", category_slug: "delta-8", delta8_disclaimer_ack: "true" }),
      { categoryRequiresCoaBySlug },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.delta8_disclaimer_ack).toBe(true);
  });
});

describe("validateRow — hemp_derived_attestation is mandatory", () => {
  it("rejects when hemp_derived_attestation is not 'true'", () => {
    const result = validateRow(buildRow({ hemp_derived_attestation: "" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "hemp_derived_attestation")).toBe(true);
    }
  });
});

describe("validateRow — status defaults and validation", () => {
  it("defaults status to pending_review when omitted", () => {
    const result = validateRow(buildRow({ status: "" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe("pending_review");
  });

  it("rejects invalid status", () => {
    const result = validateRow(buildRow({ status: "draft" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "status")).toBe(true);
    }
  });

  it("accepts status=approved", () => {
    const result = validateRow(buildRow({ status: "approved" }), { categoryRequiresCoaBySlug });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe("approved");
  });
});

describe("CSV_TEMPLATE_HEADERS", () => {
  it("includes every column the validator reads", () => {
    const expected = [
      "vendor_id",
      "name",
      "description",
      "price_cents",
      "category_slug",
      "product_type",
      "image_url",
      "coa_url",
      "ship_to_states",
      "status",
      "hemp_derived_attestation",
      "delta8_disclaimer_ack",
    ];
    for (const col of expected) {
      expect(CSV_TEMPLATE_HEADERS).toContain(col);
    }
  });
});
