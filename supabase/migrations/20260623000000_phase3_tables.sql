-- Phase 3: Influencer Intelligence + Competitive Sightings + Weekly Briefings + Creative Analyses

-- ── influencers ───────────────────────────────────────────────────────────────
create table if not exists influencers (
  id              uuid        primary key default gen_random_uuid(),
  brand_id        uuid        not null references brands(id) on delete cascade,
  name            text        not null,
  handle          text        not null,
  platform        text        not null
                              check (platform in ('instagram','tiktok','twitter','youtube','facebook')),
  category        text,
  followers       integer     not null default 0,
  cultural_iq     numeric(5,2),
  risk_score      numeric(5,2),
  ai_notes        text,
  status          text        not null default 'prospect'
                              check (status in ('prospect','active','paused','rejected')),
  campaign_id     uuid        references campaigns(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_influencers_brand  on influencers(brand_id);
create index if not exists idx_influencers_status on influencers(brand_id, status);

alter table influencers enable row level security;
create policy influencers_workspace_member on influencers
  for all using (
    brand_id in (
      select b.id from brands b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );

-- ── competitor_sightings: add phase-3 columns to existing table ───────────────
-- The base table was created in initial_schema with occurred_at / observation_type / notes.
-- The competitive module now uses competitor_name, sighting_type, city, state, description, spotted_at.
alter table competitor_sightings
  add column if not exists competitor_name text,
  add column if not exists sighting_type   text
                                           check (sighting_type is null or sighting_type in
                                             ('billboard','event','digital','print','tv','radio','activation','pr')),
  add column if not exists city            text,
  add column if not exists state           text,
  add column if not exists description     text,
  add column if not exists spotted_at      date not null default current_date;

create index if not exists idx_sightings_date on competitor_sightings(brand_id, spotted_at desc);

-- ── weekly_briefings ──────────────────────────────────────────────────────────
create table if not exists weekly_briefings (
  id          uuid        primary key default gen_random_uuid(),
  brand_id    uuid        not null references brands(id) on delete cascade,
  week_start  date        not null,
  content     jsonb       not null default '{}'::jsonb,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (brand_id, week_start)
);
create index if not exists idx_briefings_brand on weekly_briefings(brand_id, week_start desc);

alter table weekly_briefings enable row level security;
create policy briefings_workspace_member on weekly_briefings
  for all using (
    brand_id in (
      select b.id from brands b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );

-- ── creative_analyses: already exists in initial_schema with asset_type columns ─
-- The phase-3 redesign (analysis_type / input_data / result) is NOT used.
-- No-op: table is correct as-is.
