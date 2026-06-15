-- A1. OOH site demographics + campaign_city columns
alter table ooh_sites add column if not exists place_demographics jsonb;
-- Structure: { "primary_audience": "young_professionals", "income_tier": "middle",
--              "age_skew": "18-34", "gender_split": "mixed",
--              "poi_types": ["café","office","bank"], "confidence": 0.75 }

alter table ooh_sites add column if not exists campaign_city text;
-- The primary city this site targets (for geo-lift city-level comparison)

-- A1. Geo-lift studies table
create table if not exists geo_lift_studies (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  campaign_id     uuid references campaigns(id) on delete set null,
  treatment_city  text not null,
  control_city    text not null,
  keyword         text not null,
  study_start     date not null,
  study_end       date not null,
  correlation     numeric(5,4),
  lift_pct        numeric(6,2),   -- % uplift in treatment vs control
  confidence      numeric(5,2),   -- statistical confidence %
  ai_interpretation text,
  status          text not null default 'pending' check (status in ('pending','running','complete','insufficient_data')),
  weekly_data     jsonb,          -- array of { week, treatment_index, control_index }
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_geolift_brand on geo_lift_studies(brand_id, created_at desc);

alter table geo_lift_studies enable row level security;

create policy geo_lift_studies_workspace_member on geo_lift_studies for all using (
  brand_id in (
    select b.id from brands b
    join workspace_members wm on wm.workspace_id = b.workspace_id
    where wm.user_id = auth.uid()
  )
);
