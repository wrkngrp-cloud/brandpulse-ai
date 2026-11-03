-- The Monday Brief (docs/spec-weekly-brief.md).
--
-- Every Monday each brand gets one answer: what moved last week, and what
-- probably moved it. It reads three things: the brand's weekly numbers (typed
-- into metric_manual, which already exists), what the brand did (campaigns,
-- which exist, and the moments below), and what the market did (press and
-- competitor moves, which exist).

-- ── When the brand wants it ─────────────────────────────────────────────────
-- Hour of Monday, Lagos time. 5am to noon, so it lands before or around the
-- weekly meeting rather than at a time nobody chose.
alter table brands add column if not exists brief_hour smallint not null default 9
  check (brief_hour between 5 and 12);

-- ── A typed number can be an index ─────────────────────────────────────────
-- A brand that will not share real figures can enter 100 for a base week and
-- move from there. The brief then talks in percentages only.
alter table metric_manual add column if not exists is_index boolean not null default false;

-- ── Moments: what the brand did that is not a campaign ─────────────────────
create table if not exists brand_moments (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  happened_on  date not null,
  kind         text not null
               check (kind in ('launch', 'price_change', 'promo', 'pr', 'outage', 'other')),
  title        text not null check (char_length(title) between 2 and 200),
  notes        text check (notes is null or char_length(notes) <= 1000),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_brand_moments_brand_day on brand_moments (brand_id, happened_on desc);

alter table brand_moments enable row level security;
create policy brand_moments_workspace_member on brand_moments for all
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)))
  with check (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));

-- ── The briefs themselves ───────────────────────────────────────────────────
-- Written only by the weekly job (service role). Members read their own;
-- nobody edits one, because a brief is a record of what we said that week.
-- share_token opens a read-only copy at /brief/<token> with no login, so a
-- marketer can forward it to their boss. Same model as the Client Portal.
create table if not exists weekly_briefs (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  week_start   date not null,           -- the Monday of the week described
  status       text not null check (status in ('ready', 'needs_numbers')),
  content      jsonb not null default '{}'::jsonb,
  share_token  text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  emailed_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (brand_id, week_start)
);
create index if not exists idx_weekly_briefs_brand on weekly_briefs (brand_id, week_start desc);

alter table weekly_briefs enable row level security;
create policy weekly_briefs_member_read on weekly_briefs for select
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
