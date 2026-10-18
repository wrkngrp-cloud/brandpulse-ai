-- The Desk: usage telemetry.
--
-- Three questions the product could not answer before this migration: what an
-- account costs us, how many AI calls they have made against their plan, and
-- which modules they actually open. usage_events has existed since June and is
-- read by the billing page, but nothing in src has ever written to it, so every
-- "AI calls this month" figure the customer sees is zero by construction.
--
-- Everything here is written server-side by the service role. Workspace members
-- read their own rows, because the billing page needs them, and staff read
-- across tenants through is_staff().

-- ── Every AI call ────────────────────────────────────────────────────────────
-- Written inside callAi, which Document 5 Part B locks as the only path for our
-- own generation. One write there instruments the whole product.
--
-- model is recorded because cost maths needs it. It is never displayed in any
-- UI, in the Desk or the product: that is a hard rule and this column is not an
-- exception to it.
create table if not exists ai_calls (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  brand_id      uuid references brands(id)     on delete set null,
  user_id       uuid references auth.users(id) on delete set null,
  tier          text not null check (tier in ('cultural','structural','chat','boardGrade')),
  model         text not null,
  -- Dotted feature key, e.g. 'funnel.diagnose'. 'unattributed' when a call site
  -- has not been wired yet, which keeps the figure honest instead of silently
  -- attributing the call to the wrong feature.
  feature       text not null default 'unattributed',
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cost_usd      numeric(12,6),
  latency_ms    integer,
  ok            boolean not null default true,
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_ai_calls_ws      on ai_calls(workspace_id, created_at desc);
create index if not exists idx_ai_calls_feature on ai_calls(feature, created_at desc);
create index if not exists idx_ai_calls_created on ai_calls(created_at desc);

alter table ai_calls enable row level security;

drop policy if exists ai_calls_workspace_read on ai_calls;
create policy ai_calls_workspace_read on ai_calls
  for select using (workspace_id is not null and is_workspace_member(workspace_id));

drop policy if exists ai_calls_staff_read on ai_calls;
create policy ai_calls_staff_read on ai_calls for select using (is_staff());

-- ── Module usage, rolled up ──────────────────────────────────────────────────
-- One row per workspace, module, person and day, never one per page view. The
-- count is views, so a quiet account reads as quiet rather than as missing.
create table if not exists feature_events (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id     uuid references brands(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  module       text not null,
  day          date not null default current_date,
  count        integer not null default 1,
  last_seen_at timestamptz not null default now(),
  primary key (workspace_id, module, day, user_id)
);
create index if not exists idx_feature_events_ws  on feature_events(workspace_id, day desc);
create index if not exists idx_feature_events_mod on feature_events(module, day desc);

alter table feature_events enable row level security;

drop policy if exists feature_events_workspace_read on feature_events;
create policy feature_events_workspace_read on feature_events
  for select using (is_workspace_member(workspace_id));

drop policy if exists feature_events_staff_read on feature_events;
create policy feature_events_staff_read on feature_events for select using (is_staff());

-- Recorded through a security-definer function rather than a service-role route,
-- so the write needs no key and still cannot be aimed at someone else's
-- workspace: the function resolves the workspace from the brand and refuses
-- unless the caller is a member of it.
create or replace function record_feature_event(p_brand_id uuid, p_module text)
returns void language plpgsql security definer
set search_path = public as $$
declare
  v_workspace uuid;
begin
  if auth.uid() is null or p_module is null or p_module = '' then
    return;
  end if;

  select b.workspace_id into v_workspace
  from public.brands b where b.id = p_brand_id;

  if v_workspace is null or not public.is_workspace_member(v_workspace) then
    return;
  end if;

  insert into public.feature_events (workspace_id, brand_id, user_id, module, day, count)
  values (v_workspace, p_brand_id, auth.uid(), p_module, current_date, 1)
  on conflict (workspace_id, module, day, user_id) do update
    set count = public.feature_events.count + 1,
        last_seen_at = now();
end $$;

-- ── usage_events: the counters the billing page already reads ────────────────
-- The table is from June. These are the pieces it was missing: a check on the
-- event type so a typo cannot create a fourth kind nobody counts, an index for
-- the per-month count, and a staff read.
alter table usage_events
  add column if not exists brand_id uuid references brands(id) on delete set null,
  add column if not exists user_id  uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'usage_events_event_type_check'
  ) then
    alter table usage_events add constraint usage_events_event_type_check
      check (event_type in ('ai_call','survey_response','portal_view'));
  end if;
end $$;

create index if not exists idx_usage_events_type
  on usage_events(workspace_id, event_type, occurred_at desc);

drop policy if exists usage_events_staff_read on usage_events;
create policy usage_events_staff_read on usage_events for select using (is_staff());
