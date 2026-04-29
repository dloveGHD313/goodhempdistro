create table if not exists public.jax_feature_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  business_name text not null,
  email text not null,
  phone text,
  website_url text,
  instagram_handle text,
  tiktok_handle text,
  vendor_type text not null,
  why_featured text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
);

alter table public.jax_feature_applications enable row level security;

create policy "Anyone can submit jax feature application"
  on public.jax_feature_applications
  for insert to anon, authenticated
  with check (
    user_id is null
    or user_id = auth.uid()
  );

create policy "Admin can read jax feature applications"
  on public.jax_feature_applications
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
