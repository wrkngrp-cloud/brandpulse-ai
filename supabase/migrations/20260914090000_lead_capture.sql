-- Lead capture for the public category press scoreboard.
--
-- Three tables and one helper. The scoreboard at /scoreboard runs without an
-- account, so the scan itself is stored here rather than against a brand: no
-- workspace exists yet for someone who has not signed up.
--
-- RLS note. Every other table in this schema scopes to a workspace through
-- is_workspace_member(). These three cannot: a lead belongs to BrandGauge the
-- company, not to a tenant. So they scope to an explicit allowlist instead,
-- and the rule that matters is the same one, written the other way round:
-- nothing here is readable by a signed-in user unless their id is in
-- lead_desk_admins. Writes are service-role only, from the public API routes.

-- ── Who may see the lead desk ────────────────────────────────────────────────
create table if not exists lead_desk_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  note       text,                -- 'EA', 'founder', why this person is here
  added_at   timestamptz not null default now()
);

alter table lead_desk_admins enable row level security;

-- Readable only by the people already on it, so an admin can see who else has
-- access. Never writable from the client: adding someone is a deliberate act
-- performed with the service role.
create policy lead_desk_admins_read on lead_desk_admins
  for select using (user_id = auth.uid());

-- security definer so it can read the allowlist past that table's own RLS,
-- which is what stops the policy recursing. The fixed search_path is the part
-- worth noting: a security-definer function without one resolves unqualified
-- names against the caller's path, so a table shadowing `lead_desk_admins`
-- would be read with this function's privileges. auth.uid() stays qualified,
-- so pinning the path costs nothing.
create or replace function is_lead_desk()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.lead_desk_admins a where a.user_id = auth.uid());
$$;

-- ── What someone ran on the public tool ──────────────────────────────────────
create table if not exists public_scans (
  id            uuid primary key default gen_random_uuid(),
  brand_name    text not null,
  competitors   jsonb not null default '[]'::jsonb,   -- ["Moniepoint","PalmPay"]
  category      text,
  -- The whole board as returned, so the desk can show what the visitor saw
  -- without re-running a crawl that would now give a different answer.
  results       jsonb not null default '{}'::jsonb,
  -- Headline figure, lifted out for sorting and for the follow-up line.
  share_of_reach numeric(5,2),
  mentions_found integer,
  -- Coarse provenance only. No raw IP: the tool promises nothing is exposed,
  -- and a hash is enough to rate-limit and to spot one person scanning fifty
  -- brands. Referrer tells us which post or page sent them.
  ip_hash       text,
  referrer      text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_public_scans_created on public_scans(created_at desc);
create index if not exists idx_public_scans_brand on public_scans(lower(brand_name));

alter table public_scans enable row level security;
create policy public_scans_read on public_scans
  for select using (is_lead_desk());

-- ── The lead ─────────────────────────────────────────────────────────────────
create table if not exists leads (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  name         text,
  company      text,
  -- The scan they had just run. This is the follow-up: their brand, their
  -- competitors, and the number they were looking at when they gave us the
  -- address.
  scan_id      uuid references public_scans(id) on delete set null,
  source       text not null default 'scoreboard'
               check (source in ('scoreboard','landing','other')),
  status       text not null default 'new'
               check (status in ('new','contacted','qualified','converted','dead')),
  -- Did they go on to open an account with this address?
  signed_up    boolean not null default false,
  -- Do they want the Monday email. An unchecked box here is a promise not made.
  wants_weekly boolean not null default false,
  notes        text,
  contacted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(email)
);

create index if not exists idx_leads_created on leads(created_at desc);
create index if not exists idx_leads_status on leads(status);

alter table leads enable row level security;
create policy leads_read on leads
  for select using (is_lead_desk());
-- The desk works the pipeline: status, notes, contacted_at.
create policy leads_update on leads
  for update using (is_lead_desk()) with check (is_lead_desk());

create or replace function touch_leads_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists leads_updated_at on leads;
create trigger leads_updated_at before update on leads
  for each row execute function touch_leads_updated_at();
