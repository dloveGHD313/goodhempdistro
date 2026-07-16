-- Brief 2026-07-16 P1: Learning with JAX content system. Additive only.
-- Extends jax_episodes (#209) with the publishing model; keeps the tier
-- early-access columns/logic intact (published_at stays; publish_at is the
-- canonical scheduled public time going forward — code uses
-- publish_at ?? published_at).

alter table public.jax_episodes
  add column if not exists pillar text not null default 'webisodes'
    check (pillar in ('business', 'basics', 'webisodes', 'deep_dives')),
  add column if not exists track text
    check (track is null or track in ('building', 'business', 'science', 'lifestyle')),
  add column if not exists teaser_video_url text,
  add column if not exists thumbnail_url text,
  add column if not exists duration_seconds integer,
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'in_review', 'approved', 'published')),
  add column if not exists publish_at timestamptz,
  add column if not exists description text,
  add column if not exists seo_tags text[] not null default '{}';

-- published_at was NOT NULL in #209; the publishing model schedules via
-- publish_at, so relax it for new rows created as drafts.
alter table public.jax_episodes alter column published_at drop not null;

create index if not exists jax_episodes_status_publish_idx
  on public.jax_episodes (status, publish_at);

-- Private media bucket: full videos are tier-gated, so playback goes
-- through server-signed URLs. Uploads via signed upload URLs (#215
-- pattern) from the admin manager.
insert into storage.buckets (id, name, public)
values ('jax-media', 'jax-media', false)
on conflict (id) do nothing;

-- Seed Episodes 001–002 as DRAFTS from the series bible
-- (LEARNING-WITH-JAX-SERIES-BIBLE-2026-07-16) so the CEO sees them in
-- the admin manager immediately. Scripts locked; assets come later via
-- the Adobe pipeline → admin upload.
insert into public.jax_episodes
  (slug, title, summary, description, episode_number, pillar, track, status, seo_tags, published_at)
select * from (values
  (
    'hemp-vs-weed-settle-it-forever',
    'Hemp vs Weed — Settle It Forever (Before the Rules Change)',
    'Same plant family — cousins, not twins. JAX settles the most-searched confusion in hemp… and teases the November rule change.',
    'Your uncle at the cookout is WRONG about hemp. JAX puts you hip: hemp is a legal definition — 0.3% THC or less. Under that? Hemp. Over it? Different rules. That hemp shirt can''t get you high; y''all been arguing about a NUMBER. But hold up — Congress just changed how they COUNT that number, and it''s about to shake the whole industry. Point-three. Tell your uncle it''s a math problem, not a moral one.',
    1,
    'webisodes',
    'lifestyle',
    'draft',
    array['hemp vs weed', 'hemp 101', 'what is hemp', 'THC limit', 'hemp legal definition'],
    null::timestamptz
  ),
  (
    'the-new-hemp-ban-what-just-happened',
    'The New Hemp Ban — What Just Happened',
    'Congress rewrote ONE definition and ~95% of intoxicating hemp products become federally unlawful November 12. JAX breaks down the $30B reset — no panic, no politics.',
    'Ninety-five percent of the hemp products in stores right now become illegal November 12th. JAX explains P.L. 119-37: hemp used to be measured by delta-9 THC only — the new law counts TOTAL THC including THCA, plus a 0.4mg-per-container cap. THCA flower, most gummies, the vapes — federally, that''s marijuana now. But the PLANT ain''t banned; the loophole is. Hemp shirts, paper, hempcrete, plates, pet products — all still legal, all still growing. The smoke shops got a deadline. The BUILDERS got an opportunity. (Attorney review before publish.)',
    2,
    'webisodes',
    'business',
    'draft',
    array['hemp ban', 'THCA ban', 'P.L. 119-37', 'total THC', 'November 12 2026', 'hemp law change'],
    null::timestamptz
  )
) as v(slug, title, summary, description, episode_number, pillar, track, status, seo_tags, published_at)
where not exists (select 1 from public.jax_episodes e where e.slug = v.slug);
