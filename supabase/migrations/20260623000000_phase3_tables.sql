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

-- ── competitor_sightings ──────────────────────────────────────────────────────
create table if not exists competitor_sightings (
  id               uuid        primary key default gen_random_uuid(),
  brand_id         uuid        not null references brands(id) on delete cascade,
  competitor_name  text        not null,
  sighting_type    text        not null
                               check (sighting_type in ('billboard','event','digital','print','tv','radio','activation','pr')),
  city             text,
  state            text,
  lat              numeric(9,6),
  lng              numeric(9,6),
  description      text,
  spotted_at       date        not null default current_date,
  created_at       timestamptz not null default now()
);
create index if not exists idx_sightings_brand on competitor_sightings(brand_id);
create index if not exists idx_sightings_date  on competitor_sightings(brand_id, spotted_at desc);

alter table competitor_sightings enable row level security;
create policy sightings_workspace_member on competitor_sightings
  for all using (
    brand_id in (
      select b.id from brands b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );

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

-- ── creative_analyses ─────────────────────────────────────────────────────────
create table if not exists creative_analyses (
  id               uuid        primary key default gen_random_uuid(),
  brand_id         uuid        not null references brands(id) on delete cascade,
  analysis_type    text        not null default 'compare'
                               check (analysis_type in ('compare','identity','competitor')),
  input_data       jsonb       not null default '{}'::jsonb,
  result           jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists idx_creative_brand on creative_analyses(brand_id, created_at desc);

alter table creative_analyses enable row level security;
create policy creative_analyses_workspace_member on creative_analyses
  for all using (
    brand_id in (
      select b.id from brands b
      join workspace_members wm on wm.workspace_id = b.workspace_id
      where wm.user_id = auth.uid()
    )
  );
