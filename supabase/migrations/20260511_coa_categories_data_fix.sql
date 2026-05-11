-- Migration: data fix for COA SSOT cutover — GATE-03
--
-- Flip requires_coa=true for all cannabinoid-containing categories so that
-- the runtime requiresCOA() helper (lib/compliance.ts) can be switched from
-- a hardcoded slug allowlist to a direct read of categories.requires_coa.
--
-- Idempotent: WHERE requires_coa = false prevents double-touches. Re-running
-- this migration is a no-op.
--
-- Slug duplicates: 4 slugs (concentrates, edibles, tinctures, vapes) have two
-- category rows each (standalone + under-Consumables parent). The
-- under-Consumables rows were already requires_coa=true pre-migration; only
-- the standalone rows flip in this migration. Operating on slug correctly
-- targets both rows when both are false.
--
-- Applied to production via Supabase MCP on 2026-05-11. Post-migration
-- counts: 17 → 103 (86 rows flipped). Full list of post-cutover true slugs:
-- .claude/audit/coa-categories-post-cutover.csv
--
-- Rollback SQL: see end of this file (commented out).

update public.categories
set requires_coa = true
where requires_coa = false
  and slug in (
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
    -- Group 3: Vapes, concentrates, smokables, raw cannabinoid material
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

-- ROLLBACK (manual — DO NOT auto-run):
-- update public.categories
-- set requires_coa = false
-- where requires_coa = true
--   and slug in (
--     -- same 86-slug list above
--   );
