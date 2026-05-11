# GATE-03 — COA categories SSOT cutover (data flip + code refactor)

**PR (planned):** `data/coa-categories-flip-then-refactor`
**Build:** Audit P1 Fix #5 + Phase 2 STEP 4
**Compliance gate change:** YES — requires CEO acknowledgement per directive Rule 6 (compliance behavior change + data UPDATE).
**Row count:** ~83 UPDATEs (well below 500-row threshold, but still gated for compliance reasons).

## What is changing

Two commits in one PR:

### Commit 1 — Data fix migration (`supabase/migrations/20260511_coa_categories_data_fix.sql`)

UPDATE `categories.requires_coa = true` for 86 cannabinoid-containing slugs that currently have `requires_coa = false`. The slug list is locked below.

### Commit 2 — Code refactor (`lib/compliance.ts`)

Replace the hardcoded `COA_EXCEPTION_PATTERNS` slug allowlist with a direct read of `categories.requires_coa` as single source of truth. The runtime `requiresCOA()` function becomes:

```ts
export function requiresCOA(category: { requires_coa?: boolean | null } | null): boolean {
  if (!category) return false;
  return category.requires_coa === true;
}
```

`getCategoryCoaRequirement()` already fetches the category row — only the helper changes.

## Why

- **AUDIT.md P1 Fix #5:** Code today uses a hardcoded slug allowlist (`COA_EXCEPTION_PATTERNS` in `lib/compliance.ts:10-24`) plus a default-true fallthrough. The DB has a `categories.requires_coa` column that the runtime ignores. Admins can't manage COA rules via DB; they have to ship code.
- **CEO Build #2 (audit alignment):** "Make `categories.requires_coa` the SSOT."

## Pre-flight verifications (run today via Supabase MCP)

### 1. Every planned slug exists in production

Query joined `unnest(planned_slugs) LEFT JOIN categories ON c.slug = ps.slug`. **Result: 0 MISSING_FROM_DB warnings.** All 86 planned slugs match real category rows.

### 2. Slug duplicate handling

Four slugs appear twice in the categories table (standalone + under-Consumables parent):

| Slug | Standalone row | Under-Consumables row | Behavior |
|---|---|---|---|
| `concentrates` | false | **true** (already) | flip standalone to true |
| `edibles` | false | **true** (already) | flip standalone to true |
| `tinctures` | false | **true** (already) | flip standalone to true |
| `vapes` | false | **true** (already) | flip standalone to true |

UPDATE statement uses `WHERE requires_coa = false AND slug IN (...)` — idempotent; only the false rows flip. **Expected total rows updated: ~83** (86 slugs minus 3 already-true duplicates from the 4 pairs… actually 4 already-true so ~82, but I'll capture exact count in PR's audit log).

### 3. Cannabinoid pattern scan — slugs the planned list MIGHT MISS

Ran broad pattern scan for `%thc%`, `%cbd%`, `%cbg%`, `%cbn%`, `%cbc%`, `%hhc%`, `%delta%`, `%cannabinoid%`, `%flower%`, `%pre-roll%`, `%vape%`, `%hemp%`, `%kratom%`, `%mushroom%`, `%edible%`, `%tincture%`, `%concentrate%`, `%topical%`, `%salve%`, `%balm%`, `%lotion%`, `%cream%`, `%soap%`, `%shatter%`, `%distillate%`, `%rosin%`, `%resin%`, `%wax%`, `%hash%`, `%kief%`, `%moonrock%`, `%pet%`, `%terpene%`, `%isolate%`.

**17 slugs matched the patterns but are NOT in the planned UPDATE:**

| Slug | Name | Why NOT flipped | CEO decision needed? |
|---|---|---|---|
| `hemp-accessories` | Hemp Accessories | Non-consumable accessories | No — confirm FALSE |
| `hemp-bags` | Hemp Bags | Textile/bag | No — confirm FALSE |
| `hemp-bedding` | Hemp Bedding | Home goods textile | No — confirm FALSE |
| `hemp-clones` | Hemp Clones | Live plant material, not finished product | No — confirm FALSE |
| `hemp-clothing` | Hemp Clothing | Apparel | No — confirm FALSE |
| `hemp-footwear` | Hemp Footwear | Apparel | No — confirm FALSE |
| `hemp-rope-cordage` | Hemp Rope & Cordage | Industrial | No — confirm FALSE |
| `hemp-seeds-agriculture-` | Hemp Seeds (Agriculture) | Seed stock, not consumer product | No — confirm FALSE |
| `hemp-textiles` | Hemp Textiles | Textile | No — confirm FALSE |
| `hemp-towels` | Hemp Towels | Home goods textile | No — confirm FALSE |
| `hempcrete-building-materials` (×2) | Hempcrete & Building Materials | Construction | No — confirm FALSE |
| `industrial-hemp-materials` | Industrial Hemp Materials | Industrial | No — confirm FALSE |
| `insulation-hemp-` | Insulation (Hemp) | Construction | No — confirm FALSE |
| `raw-hemp-biomass` | Raw Hemp Biomass | Agricultural raw material | **CEO call** — could be processed into consumables but sold as raw |
| `vape-batteries-chargers` | Vape Batteries & Chargers | Hardware, not the vape itself | No — confirm FALSE |
| `candles-hemp-cbd-` | Candles (Hemp/CBD) | Burned, may aerosolize trace cannabinoids | **CEO call** — debatable |

**Two CEO judgment calls:** Should `raw-hemp-biomass` and `candles-hemp-cbd-` require COA?
- My recommendation: **leave both FALSE.** Biomass is a B2B raw material between vendors; the COA happens at the processed-product stage. Candles are decorative — the actual cannabinoid content delivered to consumer per use is negligible vs. ingestible products.
- If CEO disagrees: add them to the UPDATE before I apply it.

## Exact UPDATE statement (will run only after CEO approval)

```sql
-- Migration: data/coa-categories-flip-then-refactor — Commit 1
-- Flip requires_coa=true for all cannabinoid-containing categories.
-- Idempotent: WHERE requires_coa = false prevents double-touches.
-- Operates on slug to safely match duplicate rows (e.g. standalone
-- "Edibles" and "Edibles" under Consumables both flip).

UPDATE public.categories
SET requires_coa = true
WHERE requires_coa = false
  AND slug IN (
    -- Group 1: Topicals / skincare / cosmetics / personal-care (applied to body)
    'cbd-balms','cbd-creams','cbd-face-oils','cbd-lotions','cbd-roll-ons',
    'cbd-serums','cbd-skincare','cbd-soaps','cbd-sunscreen','cbd-bath-bombs',
    'topicals','massage-oils','lubricants-hemp-cbd-',
    'personal-wellness','sleep-relaxation','stress-support',
    'muscle-recovery','arthritis-joint-support','aromatherapy',
    -- Group 2: Consumables — tinctures, edibles, beverages, supplements, hemp foods
    'tinctures','tinctures-recreational-','tinctures-wellness-',
    'cbd-edibles-wellness-','cbd-cooking-oils','cbd-coffee-tea',
    'cbd-beverages','cbd-energy-drinks','cbd-seltzers',
    'cbd-capsules','cbd-softgels','cbd-gummies-wellness-',
    'cbd-powders','cbd-isolate-bulk-',
    'edibles','gummies','hard-candy','mints','chocolates','syrups','baked-goods',
    'cbg-isolate-bulk-','cbg-supplements','cbn-sleep-supplements',
    'hemp-honey','hemp-protein','hemp-flour','hemp-granola','hemp-hearts',
    'hemp-snacks','hemp-seed-foods','hemp-beverages',
    'hemp-chocolate-non-intoxicating-','hemp-oil-food-grade-',
    -- Group 3: Vapes, concentrates, smokables, raw cannabinoid material (inhaled/extracted)
    'vapes','vapes-cartridges','disposable-vapes',
    'concentrates','shatter','distillate','distillate-bulk-',
    'live-resin','live-rosin-gummies','wax','hash','kief','rosin','moonrocks',
    'infused-pre-rolls','flower','pre-rolls','blunts',
    'smokable-hemp-cbd-','smokable-hemp-cbg-','smokable-hemp-cbn-',
    'hemp-flower-bulk-','hemp-extracts-bulk-',
    'thca','thcp','hhc','delta-8','delta-9-hemp-derived',
    'terpenes-bulk-',
    -- Group 4: Pet consumables/applied
    'pet-cbd','pet-tinctures','pet-topicals','pet-treats'
  );
```

## Behavior diff under the SSOT swap

The behavior change between **today's slug-allowlist + default-true** model and the **DB-as-SSOT** model breaks into three buckets:

1. **Cannabinoid categories that go from "required (via default fallthrough)" → "required (via DB explicit true)":** ~86 categories. **NO BEHAVIOR CHANGE.** Same enforcement, cleaner source.

2. **Apparel/textile categories that were exempt under slug allowlist:** clothing, hemp-clothing, accessories (×2), hemp-accessories, textiles-apparel, hemp-textiles, fabric-yarn, fiber-textiles-industrial-. After SSOT swap they remain `requires_coa=false`. **NO BEHAVIOR CHANGE.**

3. **Non-cannabinoid, non-apparel categories (equipment, packaging, services, growing supplies, raw materials, etc.):** Today they fall through to "COA REQUIRED" because nothing matches their slug in `COA_EXCEPTION_PATTERNS`. After SSOT swap they become `requires_coa=false` and **drop the COA requirement.** This is a **LOOSENING for these categories**, and it's correct — Cultivation Consulting, Lab Equipment, Packaging, etc. shouldn't need a cannabinoid certificate of analysis.

Affected categories in bucket 3 (sample, not exhaustive): bottles-droppers, jars-containers, cultivation-consulting, cultivation-equipment, extraction-equipment, lab-equipment, packaging-equipment, growing-supplies, nutrients-soil, glass-pipes, grinders, rolling-papers, labels-printing, lighters-torches, legal-compliance, logistics-fulfillment, marketing-branding, white-label-products, seeds, seeds-genetics, paper-pulp, plastics-composites, fiberboard-panels, construction-renovation, hempcrete-building-materials, insulation, insulation-hemp-, bulk-orders, distributor-deals, wholesale, wholesale-bulk, sampler-packs, etc.

**Important: 0 currently-existing products live in any bucket-3 category** (catalog has 1 product in `Clothing`). So the loosening is a configuration change for future seeded products, not a retroactive un-gating of approved products.

## Rollback plan

### For Commit 1 (data migration):

```sql
-- Revert the requires_coa flips. Only touches rows we set this PR.
UPDATE public.categories
SET requires_coa = false
WHERE requires_coa = true
  AND slug IN (<same list above>);
```

Save this revert SQL alongside the migration file so it's ready if needed.

### For Commit 2 (code refactor):

`git revert <merge-sha>` restores `COA_EXCEPTION_PATTERNS` and the slug-substring matching. Compatible with either DB state (works whether requires_coa values are flipped or not).

### Order of rollback if BOTH need to revert:

1. Code first (`git revert`) — restores slug-allowlist runtime
2. Data second (revert SQL) — restores false values

This order means the runtime never reads stale DB values it would treat as authoritative.

## CEO approval requested

1. **Apply UPDATE statement as written** + **ship code refactor** (recommended).
2. **Same, but also flip `raw-hemp-biomass` and `candles-hemp-cbd-` to true** — add to the UPDATE.
3. **Hold one of the two commits** — e.g., apply migration but defer code refactor (uncommon — keeps double bookkeeping).
4. **Reject — slug allowlist stays** (uncommon — leaves the divergence in place).

Awaiting your reply. If option 1 or 2, I will:
1. Apply migration via Supabase MCP, log exact row count
2. Commit migration file to repo
3. Commit code refactor
4. Open PR with both commits
5. Smoke-test against approved-product-aware compliance flow (GHD Tee should still NOT require COA; if a tincture product existed, it WOULD)

Halting per Rule 6 until CEO chooses option 1, 2, 3, or 4.
