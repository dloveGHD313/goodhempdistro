-- Shop brief 2026-07-14 P1: compliance-driven category matrix. Additive only.
--
-- All flags live on categories so the CEO tunes compliance without code
-- changes. legal_review_status is the loosening gate: 'pending' categories
-- are treated FULLY RESTRICTIVE in code (COA + 21+ required) regardless of
-- their other flags. Existing categories are stamped 'approved' to preserve
-- live behavior (COA flags were CEO-reviewed in GATE-03); the column
-- DEFAULT stays 'pending' so every future category starts restrictive.
--
-- ⚠️ SEEDED MATRIX REQUIRES CEO + CANNABIS-ATTORNEY REVIEW before loosening
-- any flag. Baseline: 2018 Farm Bill (≤0.3% delta-9 THC dry weight); state
-- divergence on delta-8/THCA/consumables is handled via data
-- (ship_restricted_states), never hardcoded conclusions.

alter table public.categories
  add column if not exists requires_age_21 boolean not null default false,
  add column if not exists requires_vendor_license_doc boolean not null default false,
  add column if not exists ship_restricted_states text[] not null default '{}',
  add column if not exists legal_review_status text not null default 'pending',
  add column if not exists category_group text;

do $$ begin
  alter table public.categories
    add constraint categories_legal_review_status_check
    check (legal_review_status in ('approved', 'pending'));
exception when duplicate_object then null; end $$;

-- Existing categories keep their live (GATE-03-reviewed) behavior.
update public.categories set legal_review_status = 'approved';

-- Conservative age-21 seed: smokables/inhalables and THC-bearing or
-- ingestible-cannabinoid categories (incl. CBD edibles — conservative;
-- CEO/attorney may loosen per category after review).
update public.categories set requires_age_21 = true
where name ~* '(flower|pre-?roll|blunt|vape|delta-?8|delta-?9|thca|thcp|hhc|moonrock|kief|hash|shatter|wax|rosin|resin|concentrate|smokable|edible|gummi|distillate|infused|tincture)';

-- Best-effort top-level grouping (display/reporting; not an enforcement input).
update public.categories set category_group = 'Apparel & Accessories'
  where category_group is null and name ~* '(clothing|apparel|footwear|textil|fabric|bag|hat|jewelry|accessor)';
update public.categories set category_group = 'Home & Kitchen'
  where category_group is null and name ~* '(towel|bedding|rope|cordage|paper|plate|cup|home|candle)';
update public.categories set category_group = 'Beauty & Personal Care'
  where category_group is null and name ~* '(soap|lotion|cream|skincare|serum|shampoo|bath|cosmetic|sunscreen|balm|salve|massage|roll-on|face oil)';
update public.categories set category_group = 'Pet'
  where category_group is null and name ~* '(^pet | pet |pet$|pet )';
update public.categories set category_group = 'Food & Beverage'
  where category_group is null and name ~* '(food|snack|granola|honey|protein|flour|hearts|beverage|coffee|tea|seltzer|energy drink|chocolate|baked|candy|mint|syrup|cooking oil)';
update public.categories set category_group = 'Smokables & Inhalables'
  where category_group is null and name ~* '(flower|pre-?roll|blunt|vape|smokable|moonrock|kief|hash|infused)';
update public.categories set category_group = 'Wellness & CBD Consumables'
  where category_group is null and (requires_coa = true);
update public.categories set category_group = 'Industrial'
  where category_group is null and name ~* '(hempcrete|insulation|plastic|composite|fiberboard|panel|biomass|pulp|industrial|construction|bioplastic)';

-- New "convenience/industrial hemp goods" categories. All start
-- legal_review_status='pending' (fully restrictive until CEO/attorney
-- approve) — the loosening review is the launch step, not the insert.
insert into public.categories (name, slug, requires_coa, requires_age_21, category_group)
select v.name, v.slug, false, false, v.category_group
from (values
  ('Hemp Paper Products', 'hemp-paper-products', 'Home & Kitchen'),
  ('Hemp Plates & Cups', 'hemp-plates-cups', 'Home & Kitchen'),
  ('Hemp Jewelry', 'hemp-jewelry', 'Apparel & Accessories'),
  ('Hemp Hats', 'hemp-hats', 'Apparel & Accessories'),
  ('Hemp Pet Toys', 'hemp-pet-toys', 'Pet'),
  ('Hemp Pet Bedding', 'hemp-pet-bedding', 'Pet'),
  ('Hemp Animal Bedding (Industrial)', 'hemp-animal-bedding-industrial', 'Industrial'),
  ('Hemp Shampoo & Haircare', 'hemp-shampoo-haircare', 'Beauty & Personal Care'),
  ('Hemp Soap (Non-CBD)', 'hemp-soap-non-cbd', 'Beauty & Personal Care'),
  ('Hemp Paper Stock (Industrial)', 'hemp-paper-stock-industrial', 'Industrial')
) as v(name, slug, category_group)
where not exists (
  select 1 from public.categories c where lower(c.name) = lower(v.name) or c.slug = v.slug
);

-- Vendor license document storage (enforced at product submit when a
-- category sets requires_vendor_license_doc; all seeds are FALSE today —
-- CEO enables per category once the vendor upload UI ships).
alter table public.vendors
  add column if not exists license_doc_url text,
  add column if not exists license_doc_object_path text;
