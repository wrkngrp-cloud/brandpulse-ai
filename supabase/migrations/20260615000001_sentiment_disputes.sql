-- Sentiment dispute / feedback table
-- Users flag a misclassified mention; disputes feed back into future classification prompts.

create table sentiment_disputes (
  id               uuid primary key default gen_random_uuid(),
  mention_id       uuid not null references mentions(id) on delete cascade,
  brand_id         uuid not null references brands(id) on delete cascade,
  user_id          uuid not null,
  original_label   text not null,
  corrected_label  text not null check (corrected_label in ('positive','neutral','negative','mixed')),
  reason           text,
  status           text not null default 'applied' check (status in ('applied','pending')),
  created_at       timestamptz not null default now()
);

create index idx_disputes_brand   on sentiment_disputes(brand_id, created_at desc);
create index idx_disputes_mention on sentiment_disputes(mention_id);

alter table sentiment_disputes enable row level security;

create policy disputes_all on sentiment_disputes for all
  using  (is_workspace_member(brand_id))
  with check (is_workspace_member(brand_id));
