-- Brief 2026-07-16 P0: federal hemp redefinition (P.L. 119-37, effective
-- 2026-11-12) — data fields only. NO ENFORCEMENT here: the
-- ENFORCE_FEDERAL_2026 feature flag (env, default OFF) gates behavior in
-- code, and the CEO flips it only after attorney sign-off. Additive only.
--
-- Law summary (CRS IF13136): hemp = TOTAL THC incl. THCA ≤0.3% dry weight;
-- final products >0.4mg total THC per container excluded; synthesized
-- cannabinoids (delta-8 from CBD conversion etc.) excluded regardless.

alter table public.products
  add column if not exists total_thc_percent numeric
    check (total_thc_percent is null or (total_thc_percent >= 0 and total_thc_percent <= 100)),
  add column if not exists total_thc_mg_per_container numeric
    check (total_thc_mg_per_container is null or total_thc_mg_per_container >= 0),
  add column if not exists contains_synthesized_cannabinoids boolean;

-- Category-level 2026 sunset warning flag: typical products in these
-- categories are largely non-compliant post-11/12. Display/reporting flag
-- for vendor warnings — NOT an enforcement input. Seeds are conservative
-- name-pattern matches; ⚠️ attorney review before relying on them.
alter table public.categories
  add column if not exists sunset_2026 boolean not null default false;

update public.categories set sunset_2026 = true
where name ~* '(thca|delta-?8|delta-?9|thcp|hhc|moonrock|infused)';
