# Catalog Import CSV — Authoritative Schema Reference

**Source of truth:** `lib/admin/catalogImport.ts` (`CatalogImportRow` + `validateRow`).
**API route:** `POST /api/admin/catalog-import` (admin-only).
**UI:** `/admin/catalog-import`.

This document exists so the v2→v3 CSV mismatch from 2026-05-19 never repeats. If you generate a CSV outside this UI, match these columns exactly. The downloadable template button on the page also emits this schema.

---

## Required columns (in this order)

| Column | Type | Required | Notes |
|---|---|---|---|
| `vendor_id` | UUID | ✅ always | Must match a real `vendors.id` whose `status = 'active'`. Get it via Supabase `SELECT id FROM vendors WHERE owner_user_id = (auth user uuid)`. |
| `name` | string ≤ 200 chars | ✅ always | Idempotency key (`vendor_id` + case-insensitive `name`). Re-importing same name updates instead of duplicating. |
| `description` | string | ⚪ optional | Long product description. Use the most detailed copy you have. |
| `price_cents` | integer > 0 | ✅ always | Cents, not dollars. `$64.00` = `6400`. |
| `category_slug` | string | ✅ always | Must match a real `categories.slug`. Anchor catalog uses `clothing`. |
| `product_type` | enum | ✅ always | One of: `non_intoxicating` \| `intoxicating` \| `delta8`. Apparel = `non_intoxicating`. |
| `image_url` | http(s) URL | 🟡 conditional | Required when `status = approved`. Optional when `status = pending_review` (the staging-import workflow). Format-checked whenever non-empty. |
| `coa_url` | http(s) URL | 🟡 conditional | Required when the resolved `category.requires_coa = true` (consumables, topicals, vapes, etc.). Empty OK for non-COA categories (apparel, accessories). |
| `ship_to_states` | comma-separated 2-letter codes | ✅ always | E.g. `AL,AK,AZ,...,WY,DC`. Codes uppercased automatically. Must be non-empty. |
| `status` | enum | ⚪ optional | One of: `approved` \| `pending_review`. Defaults to `pending_review` if omitted (staged hidden from storefront). |
| `hemp_derived_attestation` | literal `"true"` | ✅ always | Explicit hemp-derivation attestation. Apparel made of hemp counts. Any value other than literal `"true"` is rejected. |
| `delta8_disclaimer_ack` | literal `"true"` | 🟡 conditional | Required when `product_type = delta8`. Otherwise leave empty. |

## Status semantics

| `status` | Effect on row | Storefront visibility |
|---|---|---|
| `pending_review` *(default)* | Inserted with `active = false`. Awaits manual admin approval. | **Hidden.** |
| `approved` | Inserted with `active = true`. Sets `reviewed_at` and `reviewed_by` to the importing admin. | **Visible** — must pass all validation including `image_url`. |

## Staging workflow

Per CEO direction the anchor-catalog flow is:

1. Import 78 SKUs with `status = pending_review` and empty `image_url` (no photos yet).
2. Per-SKU: edit via product admin UI → upload real image → admin reviews → status flips to `approved` for marketing drops.

The importer is loosened so step 1 doesn't require placeholder URLs. The product-edit UI re-enforces `image_url` at the point of approval, so a hidden SKU can never become storefront-visible without an image.

## Columns the importer accepts but doesn't require

The importer parses only the columns listed in the **Required columns** table. Extra columns (e.g., `sku`, `inventory_count`, `weight_grams`, `short_description`, `bullet_specs`) are **silently ignored**, not rejected. You can include them in the CSV if you're using it as a single source for vendor tooling outside the importer — but the importer won't store them.

## Common rejection causes (every error message references the column)

| Error | Cause | Fix |
|---|---|---|
| `vendor_id is required` | Column blank | Fill in the vendor's UUID on every row. |
| `vendor_id must be a UUID` | Not in `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` shape | Look up via Supabase SELECT on `vendors`. |
| `vendor X not found in vendors table` | UUID doesn't match an existing vendor | Verify the vendor exists and the UUID matches exactly. |
| `vendor X is not active` | Vendor exists but `status != 'active'` | Activate the vendor first via admin tooling. |
| `name is required` | Column blank | Fill in the product name. |
| `price_cents must be > 0` | 0, negative, or non-numeric | Convert dollars to cents. `$10.99` = `1099`. |
| `category_slug "X" not found in categories table` | Slug doesn't exist | Use only slugs from `SELECT slug FROM categories`. |
| `product_type must be one of: non_intoxicating \| intoxicating \| delta8` | Invalid enum | Match exact spelling. Apparel = `non_intoxicating`. |
| `image_url is required when status="approved"` | Trying to import as approved without image | Either supply image OR import as `pending_review` and approve later. |
| `image_url must be an http(s) URL` | Non-empty but not http(s) | Empty is fine for `pending_review`; otherwise must start with `http://` or `https://`. |
| `ship_to_states is required` | Column blank | Supply at least one 2-letter state code. |
| `ship_to_states must be comma-separated 2-letter state codes` | Bad format | Use `TN` not `Tennessee` or `tenn`. Commas, no spaces required. |
| `coa_url is required (category "X" has requires_coa=true)` | Cannabinoid category needs COA | Upload COA, get the public URL. |
| `hemp_derived_attestation must be "true"` | Column blank or any other value | Set literal `true` string on every row. |
| `delta8_disclaimer_ack must be "true" for delta8 products` | Missing on delta8 rows | Required only when `product_type = delta8`. |

## Example row (anchor catalog v3)

```csv
vendor_id,name,description,price_cents,category_slug,product_type,image_url,coa_url,ship_to_states,status,hemp_derived_attestation,delta8_disclaimer_ack
debf6809-dbb4-4987-aabe-60c5fdf7ab49,GHD Hemp Crest Tee — Back Crest Natural,"The GHD Hemp Crest Tee — Back Crest Natural is a premium hemp-based piece...",6400,clothing,non_intoxicating,,,"AL,AK,AZ,AR,...,WY,DC",pending_review,true,
```

## Header template (downloadable)

The downloadable template button at `/admin/catalog-import` emits this exact header order, sourced from `CSV_TEMPLATE_HEADERS` in `lib/admin/catalogImport.ts`:

```
vendor_id,name,description,price_cents,category_slug,product_type,image_url,coa_url,ship_to_states,status,hemp_derived_attestation,delta8_disclaimer_ack
```

When in doubt: download the template, paste your data in, save. Don't hand-roll the schema.
