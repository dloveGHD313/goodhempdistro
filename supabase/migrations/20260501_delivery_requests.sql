create table if not exists public.delivery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  pickup_address text not null,
  delivery_address text not null,
  item_description text not null,
  preferred_datetime text not null,
  contact_name text not null,
  contact_phone text not null,
  contact_email text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
