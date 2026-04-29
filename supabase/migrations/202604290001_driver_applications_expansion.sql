alter table public.driver_applications
  add column if not exists email text,
  add column if not exists years_experience text,
  add column if not exists has_valid_license boolean not null default false,
  add column if not exists is_21_or_older boolean not null default false,
  add column if not exists can_pass_background_check boolean not null default false,
  add column if not exists why_drive text,
  add column if not exists license_front_path text,
  add column if not exists license_back_path text,
  add column if not exists insurance_path text,
  add column if not exists registration_path text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists admin_notes text;

alter table public.driver_applications alter column user_id drop not null;

insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;
