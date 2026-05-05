-- Production correction migration applied 2026-05-04
--
-- The application code in this repo references products.coa_object_path
-- and services.coa_object_path. The production database had products
-- with column name coa_storage_path (cause unknown — possibly manual
-- DDL during early development) and services was missing the column
-- entirely.
--
-- This migration records the corrective DDL that was applied directly
-- via Supabase MCP. The IF EXISTS / IF NOT EXISTS guards make this safe
-- to run on any environment (local, preview, production).

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'coa_storage_path'
  ) then
    alter table public.products
      rename column coa_storage_path to coa_object_path;
  end if;
end $$;

alter table public.services
  add column if not exists coa_object_path text;
