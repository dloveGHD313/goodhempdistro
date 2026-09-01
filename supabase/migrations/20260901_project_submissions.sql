-- Build: project submissions → vendor matching (contractor/developer lead-gen).
-- Public form inserts; reads are admin/service-role only.

create table if not exists public.project_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contact_name text not null,
  company text,
  email text not null,
  phone text,
  submitter_role text not null default 'other'
    check (submitter_role in ('contractor','developer','architect','builder','homeowner','other')),
  project_type text not null,
  state text not null,
  city text,
  timeline text,
  budget_range text,
  description text not null,
  categories text[] not null default '{}',
  status text not null default 'new'
    check (status in ('new','matched','contacted','closed','spam')),
  matched_vendor_ids uuid[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists project_submissions_created_at_idx
  on public.project_submissions (created_at desc);
create index if not exists project_submissions_status_idx
  on public.project_submissions (status);

alter table public.project_submissions enable row level security;

-- Public form can insert (same pattern as jax_feature_applications);
-- nobody but service_role can read/update/delete.
drop policy if exists project_submissions_public_insert on public.project_submissions;
create policy project_submissions_public_insert
  on public.project_submissions for insert
  to anon, authenticated
  with check (true);

grant insert on public.project_submissions to anon, authenticated;
grant all on public.project_submissions to service_role;
