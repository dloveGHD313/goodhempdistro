# HALT — Catalog seed required before Phase 2.5

**Status:** Phase 2 complete. Phase 2.5 (anchor catalog seed) is a **human-driven step**. Phase 3 (Stripe Connect, Ask JAX, regional compliance UI surfaces) cannot proceed without real products in the DB.

## Why this halt exists

Production catalog state as of Phase 2 close:

| Resource | Count |
|---|---:|
| Total products | **1** (GHD Tee) |
| Live products (status=approved AND active=true) | **1** |
| Active vendors | 3 |
| Total events | 0 |
| Services | 2 |
| Paid orders | 0 |

Most of CEO's Build queue (#3 Stripe Connect, #4 Ask JAX, #5 regional compliance UI, #8 events payout, #9 individual service pages) requires real products to verify against. Shipping those before catalog content means we're building UI on empty data structures and can't smoke-test end-to-end flows.

## What CEO needs to do

1. **Open** [/admin/catalog-import](https://www.goodhempdistro.com/admin/catalog-import) while signed in as admin (`dlove313d@gmail.com` or `hellogoodhempdistros@gmail.com`)
2. **Download** the CSV template (button at top of page)
3. **Fill in** the anchor catalog. Per AUDIT.md Section 5 recommendation: ~12 products covering top categories. Minimum required columns:
   - `vendor_id` — UUID of active vendor (3 available: good hemp distro, DLove Test Vendor, D&K Luxury Transportation)
   - `name`, `description`, `price_cents`
   - `category_slug` — must match a slug in the categories table
   - `product_type` — `non_intoxicating` / `intoxicating` / `delta8`
   - `image_url` — Supabase storage URL or external HTTPS image
   - `coa_url` — required when category has `requires_coa=true` (103 of 169 categories per GATE-03)
   - `ship_to_states` — comma-separated 2-letter codes (e.g. `CA,CO,OR,WA,TX`)
   - `hemp_derived_attestation` — must be `true`
   - `delta8_disclaimer_ack` — required `true` for delta8 products
   - `status` — `approved` (visible immediately) or `pending_review` (queued)
4. **Upload** the CSV. Inline error table will surface any row-level validation issues.
5. **Verify** at [/products](https://www.goodhempdistro.com/products) — uploaded `status=approved` products should appear publicly.

## Suggested anchor SKU mix

Audit recommended ~12 anchor products covering the top categories. Suggested mix that exercises every downstream code path:

- 1 × Clothing (non_intoxicating, no COA) → tests apparel flow
- 2-3 × CBD topicals (tinctures, balms) → tests SSOT COA requirement
- 2-3 × Edibles (gummies, chocolates) → tests Consumables parent loosening
- 1-2 × Delta-8 products → tests delta8_disclaimer flow + intoxicating cutoff
- 1 × Vape → tests inhalable category
- 1-2 × Wholesale/bulk → tests B2B-ish surfaces
- 1 × Pet product → tests pet-specific category

## Idempotency note

The import upserts on `(vendor_id, lower(name))`. Re-uploading the same CSV updates instead of duplicating. Safe to iterate on the same CSV file.

## After catalog is seeded → resume Phase 3

CEO directive Phase 3 verification (per directive's original spec):
- 3.1 Re-run schema audit; confirm zero drift
- 3.2 Re-crawl all routes; confirm zero new console errors, zero new 4xx/5xx, Lighthouse mobile ≥ 80
- 3.3 Run the 10-item Definition of Launch-Ready checklist
- 3.4 Generate `FINAL_STATUS.md`

The first three Phase 3 builds that depend on catalog presence:
- **Build #3 — Stripe Connect autonomous payouts** (CEO gate per Rule 6 — Stripe live mode)
- **Build #4 — Ask JAX OpenAI integration** (CEO gate per Rule 6 — cost ceiling)
- **Build #5 — Regional compliance state-restriction matrix** (CEO gate per Rule 6 — state matrix)

Each requires its own GATE doc and CEO approval before I begin code work.

## Standing the seed flow up

If you'd like me to seed a placeholder catalog so /products has content for screenshots/marketing while you work on real SKUs, I can write a temporary `data/anchor-catalog-placeholder.sql` migration with ~12 obviously-temporary product rows. **Halt point:** That would be a Rule 6 compliance-adjacent change (writing products to live DB), so I'd write a GATE-05 doc first asking which products and which vendors.

Otherwise: **awaiting CEO catalog upload.** Phase 2 ships are stable in production.
