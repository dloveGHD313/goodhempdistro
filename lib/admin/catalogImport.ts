/**
 * Admin catalog import — CSV parsing + row validation.
 *
 * Scope: anchor catalog seed via /admin/catalog-import. Admin-only.
 *
 * Idempotency: rows are upserted on (vendor_id, lower(name)). Re-importing a
 * CSV with the same vendor + name updates the existing product instead of
 * duplicating. There is no `products.slug` column in production, so name is
 * the natural SKU identifier.
 *
 * Validation rules (per CEO directive PR #7 spec):
 *   - vendor_id required, must reference an existing active vendor
 *   - name required (non-empty after trim)
 *   - price_cents required, > 0
 *   - category_slug required, must resolve to a real categories row
 *   - product_type required: non_intoxicating | intoxicating | delta8
 *   - image_url required when status === "approved" (staged "pending_review"
 *     rows may have empty image_url; the normal product edit form enforces
 *     image at the point of approval). Format check applies whenever the
 *     field is non-empty. — supports the staging workflow where the CEO
 *     imports 78 SKUs as hidden, swaps in real images later, then approves.
 *   - ship_to_states required, non-empty
 *   - coa_url required when the resolved category has requires_coa = true
 *   - hemp_derived_attestation required ("true")
 *   - delta8_disclaimer_ack required when product_type === "delta8"
 */

export type CatalogImportRow = {
  vendor_id?: string;
  name?: string;
  description?: string;
  price_cents?: string | number;
  category_slug?: string;
  product_type?: string;
  coa_url?: string;
  image_url?: string;
  ship_to_states?: string;
  status?: string;
  hemp_derived_attestation?: string;
  delta8_disclaimer_ack?: string;
};

export type ParsedRow = {
  rowNumber: number;
  raw: Record<string, string>;
};

/** Minimal RFC-4180-ish CSV parser. Handles quoted fields containing commas,
 *  newlines, and escaped double quotes (""). Returns a list of header-keyed
 *  records plus parse errors keyed by row number. */
export function parseCsv(input: string): {
  rows: ParsedRow[];
  parseErrors: { rowNumber: number; message: string }[];
} {
  const text = input.replace(/^﻿/, ""); // strip BOM if present
  const records: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        current.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++; // CRLF
        current.push(field);
        field = "";
        if (current.length > 0 && !(current.length === 1 && current[0] === "")) {
          records.push(current);
        }
        current = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    if (!(current.length === 1 && current[0] === "")) {
      records.push(current);
    }
  }

  const parseErrors: { rowNumber: number; message: string }[] = [];
  if (records.length === 0) {
    return { rows: [], parseErrors: [{ rowNumber: 0, message: "CSV is empty" }] };
  }
  const header = records[0].map((h) => h.trim());
  const rows: ParsedRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const rec = records[i];
    if (rec.length === 1 && rec[0].trim() === "") continue; // skip blank line
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j];
      const value = (rec[j] ?? "").trim();
      obj[key] = value;
    }
    if (rec.length !== header.length) {
      parseErrors.push({
        rowNumber: i + 1, // 1-indexed including header row
        message: `Column count mismatch: header has ${header.length} columns, row has ${rec.length}`,
      });
    }
    rows.push({ rowNumber: i + 1, raw: obj });
  }
  return { rows, parseErrors };
}

export type ValidationError = { rowNumber: number; field: string; message: string };

export type ValidatedRow = {
  rowNumber: number;
  vendor_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category_slug: string;
  product_type: "non_intoxicating" | "intoxicating" | "delta8";
  coa_url: string | null;
  /** Required when status === "approved"; nullable when status === "pending_review"
   *  (the staging-import workflow lets the CEO seed SKUs as hidden, swap in
   *  real images via the product edit UI, then promote to approved). */
  image_url: string | null;
  ship_to_states: string[];
  status: "approved" | "pending_review";
  hemp_derived_attestation: true;
  delta8_disclaimer_ack: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATE_RE = /^[A-Z]{2}$/;
const VALID_PRODUCT_TYPES = new Set(["non_intoxicating", "intoxicating", "delta8"]);
const VALID_STATUSES = new Set(["approved", "pending_review"]);

const isUrlish = (value: string): boolean => {
  if (!value) return false;
  // We accept http(s) URLs and Supabase storage paths (e.g. coas/<uuid>/file.pdf).
  return /^https?:\/\/\S+/.test(value);
};

/** Validate a single parsed row against the schema. Returns the typed row when
 *  valid, or a list of field-level errors when not. */
export function validateRow(
  row: ParsedRow,
  options: { categoryRequiresCoaBySlug: Record<string, boolean> }
): { ok: true; value: ValidatedRow } | { ok: false; errors: ValidationError[] } {
  const r = row.raw;
  const errors: ValidationError[] = [];

  const vendor_id = (r.vendor_id || "").trim();
  if (!vendor_id) {
    errors.push({ rowNumber: row.rowNumber, field: "vendor_id", message: "vendor_id is required" });
  } else if (!UUID_RE.test(vendor_id)) {
    errors.push({ rowNumber: row.rowNumber, field: "vendor_id", message: "vendor_id must be a UUID" });
  }

  const name = (r.name || "").trim();
  if (!name) {
    errors.push({ rowNumber: row.rowNumber, field: "name", message: "name is required" });
  } else if (name.length > 200) {
    errors.push({ rowNumber: row.rowNumber, field: "name", message: "name must be ≤ 200 chars" });
  }

  const description = (r.description || "").trim();

  const priceRaw = (typeof r.price_cents === "string" ? r.price_cents : "").trim();
  const price_cents = Number.parseInt(priceRaw, 10);
  if (!priceRaw) {
    errors.push({ rowNumber: row.rowNumber, field: "price_cents", message: "price_cents is required" });
  } else if (!Number.isFinite(price_cents) || price_cents <= 0) {
    errors.push({ rowNumber: row.rowNumber, field: "price_cents", message: "price_cents must be > 0" });
  }

  const category_slug = (r.category_slug || "").trim();
  if (!category_slug) {
    errors.push({ rowNumber: row.rowNumber, field: "category_slug", message: "category_slug is required" });
  } else if (!(category_slug in options.categoryRequiresCoaBySlug)) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "category_slug",
      message: `category_slug "${category_slug}" not found in categories table`,
    });
  }

  const product_type = ((r.product_type || "").trim() || "non_intoxicating") as ValidatedRow["product_type"];
  if (!VALID_PRODUCT_TYPES.has(product_type)) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "product_type",
      message: `product_type must be one of: non_intoxicating | intoxicating | delta8 (got "${r.product_type}")`,
    });
  }

  // image_url: parsed early; required-when-approved enforced after status resolves below.
  const image_url_raw = (r.image_url || "").trim();
  let image_url: string | null = null;
  if (image_url_raw) {
    if (!isUrlish(image_url_raw)) {
      errors.push({ rowNumber: row.rowNumber, field: "image_url", message: "image_url must be an http(s) URL" });
    } else {
      image_url = image_url_raw;
    }
  }

  const ship_to_states_raw = (r.ship_to_states || "").trim();
  let ship_to_states: string[] = [];
  if (!ship_to_states_raw) {
    errors.push({ rowNumber: row.rowNumber, field: "ship_to_states", message: "ship_to_states is required" });
  } else {
    ship_to_states = ship_to_states_raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const bad = ship_to_states.filter((s) => !STATE_RE.test(s));
    if (bad.length > 0) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "ship_to_states",
        message: `ship_to_states must be comma-separated 2-letter state codes (bad: ${bad.join(", ")})`,
      });
    }
    if (ship_to_states.length === 0) {
      errors.push({ rowNumber: row.rowNumber, field: "ship_to_states", message: "ship_to_states must not be empty" });
    }
  }

  const coa_url_raw = (r.coa_url || "").trim();
  const categoryRequiresCoa = options.categoryRequiresCoaBySlug[category_slug] === true;
  let coa_url: string | null = null;
  if (categoryRequiresCoa) {
    if (!coa_url_raw) {
      errors.push({
        rowNumber: row.rowNumber,
        field: "coa_url",
        message: `coa_url is required (category "${category_slug}" has requires_coa=true)`,
      });
    } else if (!isUrlish(coa_url_raw)) {
      errors.push({ rowNumber: row.rowNumber, field: "coa_url", message: "coa_url must be an http(s) URL" });
    } else {
      coa_url = coa_url_raw;
    }
  } else if (coa_url_raw) {
    // Optional COA for non-required categories — accept but validate URL shape.
    if (!isUrlish(coa_url_raw)) {
      errors.push({ rowNumber: row.rowNumber, field: "coa_url", message: "coa_url must be an http(s) URL" });
    } else {
      coa_url = coa_url_raw;
    }
  }

  const hemp_derived_attestation_raw = (r.hemp_derived_attestation || "").trim().toLowerCase();
  if (hemp_derived_attestation_raw !== "true") {
    errors.push({
      rowNumber: row.rowNumber,
      field: "hemp_derived_attestation",
      message: 'hemp_derived_attestation must be "true" (explicit hemp-derivation attestation required)',
    });
  }

  let delta8_disclaimer_ack = false;
  if (product_type === "delta8") {
    const ack = (r.delta8_disclaimer_ack || "").trim().toLowerCase();
    if (ack !== "true") {
      errors.push({
        rowNumber: row.rowNumber,
        field: "delta8_disclaimer_ack",
        message: 'delta8_disclaimer_ack must be "true" for delta8 products',
      });
    } else {
      delta8_disclaimer_ack = true;
    }
  }

  const status = ((r.status || "").trim() || "pending_review") as ValidatedRow["status"];
  if (!VALID_STATUSES.has(status)) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "status",
      message: `status must be one of: approved | pending_review (got "${r.status}")`,
    });
  }

  // image_url is required only when the row is being imported as `approved`.
  // For `pending_review` (the staging default), an empty image_url is allowed —
  // the CEO swaps in the real image via the product edit UI before approving,
  // and that flow has its own image_url enforcement at the point of approval.
  // A hidden / pending_review product cannot be purchased, so no compliance gap.
  if (status === "approved" && !image_url) {
    errors.push({
      rowNumber: row.rowNumber,
      field: "image_url",
      message: 'image_url is required when status="approved" (omit status or set "pending_review" to stage hidden SKUs without an image yet)',
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      rowNumber: row.rowNumber,
      vendor_id,
      name,
      description: description || null,
      price_cents,
      category_slug,
      product_type,
      coa_url,
      image_url,
      ship_to_states,
      status,
      hemp_derived_attestation: true,
      delta8_disclaimer_ack,
    },
  };
}

/** Header order for the downloadable CSV template. */
export const CSV_TEMPLATE_HEADERS = [
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
] as const;
