-- OOH Intelligence Module (Module 7)
-- Adds per-visit log and search uplift correlation tables

-- ── ooh_visits: per-visit attribution log ────────────────────────────────────
create table ooh_visits (
  id          uuid        primary key default gen_random_uuid(),
  site_id     uuid        not null references ooh_sites(id) on delete cascade,
  brand_id    uuid        not null references brands(id)    on delete cascade,
  visited_at  timestamptz not null default now(),
  ip_region   text,
  device_type text,
  referrer    text,
  utm_source  text,
  utm_medium  text,
  utm_campaign text,
  utm_content text
);
create index idx_ooh_visits_site  on ooh_visits(site_id);
create index idx_ooh_visits_brand on ooh_visits(brand_id);
create index idx_ooh_visits_time  on ooh_visits(visited_at);

-- ── ooh_search_uplift: weekly branded-search correlation ─────────────────────
create table ooh_search_uplift (
  id            uuid        primary key default gen_random_uuid(),
  brand_id      uuid        not null references brands(id) on delete cascade,
  site_id       uuid        references ooh_sites(id) on delete cascade,
  keyword       text        not null,
  week_start    date        not null,
  search_index  numeric(5,2),
  ooh_visits    integer     default 0,
  correlation   numeric(6,4),
  interpretation text,
  created_at    timestamptz not null default now(),
  unique (brand_id, keyword, week_start)
);
create index idx_ooh_uplift_brand on ooh_search_uplift(brand_id);
create index idx_ooh_uplift_week  on ooh_search_uplift(week_start);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table ooh_visits         enable row level security;
alter table ooh_search_uplift  enable row level security;

create policy ooh_visits_workspace_member on ooh_visits
  for all using (
    exists (
      select 1 from brands b
      where b.id = brand_id
        and is_workspace_member(b.workspace_id)
    )
  );

create policy ooh_search_uplift_workspace_member on ooh_search_uplift
  for all using (
    exists (
      select 1 from brands b
      where b.id = brand_id
        and is_workspace_member(b.workspace_id)
    )
  );

-- ── Helper: atomic visits counter increment ───────────────────────────────────
create or replace function increment_ooh_visits(site_id uuid)
returns void
language sql
security definer
as $$
  update ooh_sites set visits = visits + 1 where id = site_id;
$$;
