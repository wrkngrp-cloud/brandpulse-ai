-- 20260629000010_regulatory_mentions.sql
create table regulatory_mentions (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  source_entity   text not null,
  mention_type    text check (mention_type in ('licence_grant','sanction','investigation','compliance_notice','positive_mention','neutral')),
  sentiment       text check (sentiment in ('positive','neutral','negative')),
  headline        text,
  url             text,
  mention_date    date,
  created_at      timestamptz default now()
);
create index on regulatory_mentions(brand_id, mention_date desc);
alter table regulatory_mentions enable row level security;
create policy "workspace members" on regulatory_mentions
  using (exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id)));
