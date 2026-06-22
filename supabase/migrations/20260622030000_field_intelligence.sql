-- FSO team management
create table if not exists fso_teams (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  token           text not null unique default encode(gen_random_bytes(24), 'hex'),
  active          boolean default true,
  notes           text,
  created_at      timestamptz default now()
);

alter table fso_teams enable row level security;
create policy "workspace members can manage fso_teams"
  on fso_teams for all
  using (is_workspace_member(workspace_id));

-- Individual FSO daily route reports
create table if not exists field_reports (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  fso_team_id     uuid not null references fso_teams(id) on delete cascade,
  fso_name        text not null,
  fso_id_code     text,
  report_date     date not null default current_date,
  state           text,
  lga             text,
  submitted_at    timestamptz default now(),
  notes           text,
  created_at      timestamptz default now()
);

create index if not exists field_reports_brand_date_idx on field_reports(brand_id, report_date);
alter table field_reports enable row level security;
create policy "workspace members can view field_reports"
  on field_reports for all
  using (is_workspace_member(workspace_id));

-- Per-outlet entries within a route report
create table if not exists field_report_outlets (
  id                    uuid primary key default gen_random_uuid(),
  field_report_id       uuid not null references field_reports(id) on delete cascade,
  brand_id              uuid not null references brands(id) on delete cascade,
  outlet_name           text,
  outlet_type           text check (outlet_type in ('supermarket', 'neighbourhood_shop', 'pharmacy', 'open_market', 'petrol_station', 'hospital', 'other')),
  -- Product availability
  product_available     boolean,
  facings_count         integer,
  stock_level           text check (stock_level in ('full', 'partial', 'out_of_stock')),
  -- Pricing
  observed_price_ngn    numeric(10,2),
  rrp_ngn               numeric(10,2),
  -- POSM compliance
  posm_present          boolean,
  posm_condition        text check (posm_condition in ('good', 'damaged', 'absent')),
  -- Competitor activity
  competitor_activity   text,
  competitor_name       text,
  -- Location
  lat                   numeric(10,7),
  lng                   numeric(10,7),
  created_at            timestamptz default now()
);

create index if not exists field_report_outlets_report_idx on field_report_outlets(field_report_id);
alter table field_report_outlets enable row level security;
create policy "workspace members can view field_report_outlets"
  on field_report_outlets for all
  using (
    exists (
      select 1 from field_reports fr
      where fr.id = field_report_outlets.field_report_id
      and is_workspace_member(fr.workspace_id)
    )
  );
