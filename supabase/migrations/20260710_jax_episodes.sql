-- Perks spec 2026-07-10 §6: Learning with JAX early access.
-- Minimal episode model — no episode infra existed (the page is a static
-- coming-soon). published_at is the PUBLIC release; paid tiers see episodes
-- tierEarlyHours sooner (computed in server code from the entitlements
-- SSOT, not stored). members_only episodes are Premium-only.
-- RLS: no anon/user policies — visibility is tier-dependent, so reads go
-- through server code using the service role, which applies the gate.

create table if not exists public.jax_episodes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  video_url text,
  episode_number integer,
  published_at timestamptz not null,
  members_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jax_episodes_published_idx
  on public.jax_episodes (published_at desc);

alter table public.jax_episodes enable row level security;
-- service-role reads/writes only; the app gates by tier server-side
