#!/usr/bin/env node
/**
 * Transform good_hemp_distros_anchor_catalog_import_GHD_v2.csv into v3 that
 * matches the importer's authoritative column schema (lib/admin/catalogImport.ts).
 *
 * Input columns (CEO's v2):
 *   vendor_id, name, short_description, long_description, price_cents,
 *   category_slug, sku, image_url, coa_url, ship_to_states, inventory_count,
 *   weight_grams, bullet_specs
 *
 * Output columns (importer schema):
 *   vendor_id, name, description, price_cents, category_slug, product_type,
 *   image_url, coa_url, ship_to_states, status, hemp_derived_attestation,
 *   delta8_disclaimer_ack
 *
 * Mappings:
 *   - vendor_id → VENDOR_ID constant (CEO's vendor uuid)
 *   - name → name
 *   - description ← long_description
 *   - price_cents → price_cents
 *   - category_slug → category_slug (already "clothing")
 *   - product_type → "non_intoxicating" (apparel)
 *   - image_url → empty (loosened importer allows when status=pending_review)
 *   - coa_url → empty (clothing has requires_coa=false)
 *   - ship_to_states → ship_to_states (already comma-separated state codes)
 *   - status → "pending_review" (staged hidden)
 *   - hemp_derived_attestation → "true" (apparel IS hemp-derived per spec)
 *   - delta8_disclaimer_ack → "" (not delta8)
 *
 * Dropped: short_description, sku, inventory_count, weight_grams, bullet_specs
 * (importer doesn't accept these; sku/inventory tracked elsewhere)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const VENDOR_ID = "debf6809-dbb4-4987-aabe-60c5fdf7ab49"; // DLove Test Vendor (dlove313d@gmail.com)
const INPUT_PATH = process.argv[2] || resolve(__dirname, "../.claude/audit/good_hemp_distros_anchor_catalog_import_GHD_v2.csv");
const OUTPUT_PATH = resolve(__dirname, "../.claude/audit/good_hemp_distros_anchor_catalog_import_GHD_v3.csv");

// Minimal RFC-4180-ish parser to mirror lib/admin/catalogImport.ts behavior.
function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const records = [];
  let current = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { current.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        current.push(field);
        field = "";
        if (current.length > 0 && !(current.length === 1 && current[0] === "")) records.push(current);
        current = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    if (!(current.length === 1 && current[0] === "")) records.push(current);
  }
  const header = records[0].map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < records.length; i++) {
    const rec = records[i];
    if (rec.length === 1 && rec[0].trim() === "") continue;
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = (rec[j] ?? "").trim();
    rows.push(obj);
  }
  return rows;
}

// RFC-4180 escape: wrap in quotes if contains comma, quote, newline, or CR.
function escapeCsv(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function main() {
  const input = readFileSync(INPUT_PATH, "utf8");
  const rows = parseCsv(input);

  const outHeaders = [
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

  const outRows = rows.map((row) => ({
    vendor_id: VENDOR_ID,
    name: row.name || "",
    description: row.long_description || row.short_description || "",
    price_cents: row.price_cents || "",
    category_slug: row.category_slug || "clothing",
    product_type: "non_intoxicating",
    image_url: "", // loosened importer allows empty when status=pending_review
    coa_url: "", // clothing has requires_coa=false
    ship_to_states: row.ship_to_states || "",
    status: "pending_review",
    hemp_derived_attestation: "true",
    delta8_disclaimer_ack: "",
  }));

  const csv = [
    outHeaders.join(","),
    ...outRows.map((r) => outHeaders.map((h) => escapeCsv(r[h])).join(",")),
  ].join("\n") + "\n";

  writeFileSync(OUTPUT_PATH, csv, "utf8");
  console.log(`Wrote ${outRows.length} rows to ${OUTPUT_PATH}`);
}

main();
