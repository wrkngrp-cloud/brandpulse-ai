-- Phase 4 foundations: sector benchmarks, survey panels, MMM runs

-- ── Sector benchmarks ────────────────────────────────────────────────────────
create table if not exists sector_benchmarks (
  id          uuid primary key default gen_random_uuid(),
  sector      text not null,
  metric      text not null, -- 'bhi' | 'sov' | 'nps' | 'sentiment' | 'ciq'
  p25         numeric,
  p50         numeric,
  p75         numeric,
  top_decile  numeric,
  sample_note text,
  as_of       date default current_date,
  created_at  timestamptz default now()
);

create unique index if not exists sector_benchmarks_sector_metric
  on sector_benchmarks (sector, metric);

-- Seed: Nigerian market benchmarks (curated from industry reports + calibration)
insert into sector_benchmarks (sector, metric, p25, p50, p75, top_decile, sample_note) values
  -- FMCG / Consumer Goods
  ('FMCG',           'bhi',       38, 52, 67, 78, 'Nigerian FMCG brands, 2024-2025'),
  ('FMCG',           'sov',        8, 14, 22, 35, 'Social share of voice %'),
  ('FMCG',           'nps',        5, 22, 41, 62, 'Net Promoter Score'),
  ('FMCG',           'sentiment', 52, 61, 71, 82, 'Blended social sentiment score'),
  -- Financial Services / Fintech
  ('Fintech',        'bhi',       32, 47, 63, 76, 'Nigerian fintechs + traditional banks'),
  ('Fintech',        'sov',        6, 11, 18, 28, 'Social share of voice %'),
  ('Fintech',        'nps',       -8, 12, 34, 55, 'Banks skew low; fintechs skew high'),
  ('Fintech',        'sentiment', 44, 56, 67, 78, 'Blended social sentiment score'),
  -- Telecommunications
  ('Telecommunications', 'bhi',   42, 58, 70, 81, 'MTN/Airtel/Glo/9mobile landscape'),
  ('Telecommunications', 'sov',   12, 21, 32, 48, 'High-spend category'),
  ('Telecommunications', 'nps',  -15,  5, 28, 50, 'Satisfaction issues common'),
  ('Telecommunications', 'sentiment', 41, 53, 64, 75, 'Blended social sentiment score'),
  -- Entertainment & Media
  ('Entertainment',  'bhi',       35, 51, 66, 79, 'Nigerian entertainment brands'),
  ('Entertainment',  'sov',        5, 12, 22, 38, 'Social share of voice %'),
  ('Entertainment',  'nps',       18, 38, 58, 74, 'Strong fan loyalty skews NPS high'),
  ('Entertainment',  'sentiment', 55, 65, 75, 86, 'Generally positive engagement'),
  -- E-commerce & Retail
  ('E-commerce',     'bhi',       30, 45, 60, 73, 'Jumia, Konga, niche players'),
  ('E-commerce',     'sov',        4,  9, 16, 26, 'Social share of voice %'),
  ('E-commerce',     'nps',       -5, 18, 38, 58, 'Delivery experience drives variance'),
  ('E-commerce',     'sentiment', 42, 54, 65, 76, 'Blended social sentiment score'),
  -- Fashion & Lifestyle
  ('Fashion',        'bhi',       28, 43, 60, 74, 'Lagos-centric fashion brands'),
  ('Fashion',        'sov',        3,  8, 16, 28, 'Social share of voice %'),
  ('Fashion',        'nps',       22, 42, 60, 78, 'Strong community loyalty'),
  ('Fashion',        'sentiment', 56, 67, 77, 88, 'Aspirational sentiment'),
  -- Food & Beverage
  ('Food & Beverage','bhi',       40, 54, 68, 80, 'QSR, packaged food, beverages'),
  ('Food & Beverage','sov',        7, 13, 21, 33, 'Social share of voice %'),
  ('Food & Beverage','nps',       15, 32, 50, 68, 'Taste + availability key drivers'),
  ('Food & Beverage','sentiment', 54, 63, 73, 83, 'Blended social sentiment score'),
  -- Healthcare & Pharma
  ('Healthcare',     'bhi',       30, 44, 59, 72, 'Nigerian pharma + health brands'),
  ('Healthcare',     'sov',        3,  7, 13, 22, 'Lower social engagement category'),
  ('Healthcare',     'nps',       10, 28, 46, 65, 'Trust-dependent'),
  ('Healthcare',     'sentiment', 48, 58, 68, 78, 'Blended social sentiment score'),
  -- Technology
  ('Technology',     'bhi',       33, 48, 63, 76, 'Nigerian tech startups + enterprise'),
  ('Technology',     'sov',        4, 10, 18, 30, 'Social share of voice %'),
  ('Technology',     'nps',        8, 28, 48, 68, 'Product-market fit variance'),
  ('Technology',     'sentiment', 50, 62, 72, 82, 'Blended social sentiment score'),
  -- Real Estate
  ('Real Estate',    'bhi',       25, 39, 55, 68, 'Developers + proptech'),
  ('Real Estate',    'sov',        3,  7, 13, 22, 'Social share of voice %'),
  ('Real Estate',    'nps',       -2, 15, 35, 56, 'Trust/delivery challenges'),
  ('Real Estate',    'sentiment', 43, 54, 64, 75, 'Blended social sentiment score')
on conflict (sector, metric) do update
  set p25 = excluded.p25, p50 = excluded.p50, p75 = excluded.p75,
      top_decile = excluded.top_decile, as_of = current_date;

-- No RLS needed (read-only reference table, not tenant data)
alter table sector_benchmarks enable row level security;
create policy "public_read" on sector_benchmarks for select using (true);

-- ── Survey panels ─────────────────────────────────────────────────────────────
create table if not exists survey_panels (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid references workspaces(id) on delete cascade,
  brand_id          uuid references brands(id)     on delete cascade,
  name              text not null,
  template_key      text not null,  -- matches survey-templates.ts keys
  cadence           text not null default 'monthly', -- 'monthly' | 'quarterly'
  next_run_at       timestamptz,
  last_run_at       timestamptz,
  recipient_emails  text[] default '{}',
  recipient_phones  text[] default '{}',
  active            boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table survey_panels enable row level security;
create policy "workspace_member_all" on survey_panels
  for all using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- ── MMM runs ─────────────────────────────────────────────────────────────────
create table if not exists mmm_runs (
  id                   uuid primary key default gen_random_uuid(),
  brand_id             uuid references brands(id)     on delete cascade,
  workspace_id         uuid references workspaces(id) on delete cascade,
  window_days          int  default 90,
  channel_contributions jsonb,  -- { ooh: 12.3, events: 24.1, radio: 8.5, ... }
  channel_spend        jsonb,  -- { ooh: 500000, events: 200000, ... }
  channel_roi          jsonb,  -- { ooh: 1.8, events: 3.2, ... }
  total_estimated_outcomes int,
  ai_summary           text,
  recommendations      jsonb, -- [{ channel, action, rationale }]
  ran_at               timestamptz default now()
);

alter table mmm_runs enable row level security;
create policy "workspace_member_all" on mmm_runs
  for all using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- ── Survey panel tracking columns on surveys (after survey_panels exists) ────
alter table surveys add column if not exists is_panel boolean default false;
alter table surveys add column if not exists panel_id uuid references survey_panels(id) on delete set null;
