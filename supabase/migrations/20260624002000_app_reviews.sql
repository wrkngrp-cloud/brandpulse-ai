create table if not exists app_store_configs (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  apple_app_id    text,  -- e.g. "123456789"
  google_pkg_name text,  -- e.g. "com.example.app"
  created_at      timestamptz not null default now(),
  unique (brand_id)
);
alter table app_store_configs enable row level security;
create policy app_store_workspace_member on app_store_configs for all using (
  brand_id in (select b.id from brands b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);

create table if not exists app_reviews (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  source          text not null check (source in ('apple','google')),
  review_id       text not null,
  author          text,
  rating          smallint check (rating between 1 and 5),
  title           text,
  body            text,
  sentiment_label text check (sentiment_label in ('positive','neutral','negative')),
  sentiment_score numeric(5,2),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (source, review_id)
);
create index idx_app_reviews_brand on app_reviews(brand_id, reviewed_at desc);
alter table app_reviews enable row level security;
create policy app_reviews_workspace_member on app_reviews for all using (
  brand_id in (select b.id from brands b join workspace_members wm on wm.workspace_id = b.workspace_id where wm.user_id = auth.uid())
);
