-- Perks spec 2026-07-10 §7: event ticket perks. Additive only.
-- events.tickets_on_sale_at: public on-sale time (null = on sale as soon
-- as published). Paid tiers may buy eventEarlyAccessHours sooner.
-- event_orders.discount_cents: applied tier discount, for reporting.

alter table public.events
  add column if not exists tickets_on_sale_at timestamptz;

alter table public.event_orders
  add column if not exists discount_cents integer not null default 0;
