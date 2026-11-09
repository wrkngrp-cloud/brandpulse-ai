-- A Desk override for the support assistant's mode, in front of
-- SUPPORT_ASSISTANT_MODE (src/lib/support/assistant/config.ts).
--
-- config.ts stays database-free on purpose: scripts/support-assistant-eval.ts
-- imports it with no Next runtime, and that must keep working. So the
-- override lives in its own table, read by a small helper
-- (src/lib/support/assistant/mode-db.ts) that every caller with no Desk
-- session already uses the service client for (webhooks, Inngest jobs). A
-- null mode means nobody has set an override; the env var decides, exactly
-- as it did before this table existed.
--
-- One fixed row rather than one per workspace: there is one assistant, one
-- inbox, one lever the owner asked for.

create table if not exists support_assistant_settings (
  id          integer primary key default 1,
  mode        text check (mode in ('off', 'suggest', 'live')),
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  constraint support_assistant_settings_singleton check (id = 1)
);

insert into support_assistant_settings (id, mode) values (1, null)
  on conflict (id) do nothing;

alter table support_assistant_settings enable row level security;

-- Visibility is broad: anyone who can open the inbox can see what mode the
-- assistant is in. Editing is narrow: only support.manage_assistant, which
-- only admin and super_admin hold.
drop policy if exists support_assistant_settings_read on support_assistant_settings;
create policy support_assistant_settings_read on support_assistant_settings
  for select using (staff_can('support.view'));

drop policy if exists support_assistant_settings_write on support_assistant_settings;
create policy support_assistant_settings_write on support_assistant_settings
  for update using (staff_can('support.manage_assistant'))
  with check (staff_can('support.manage_assistant'));

-- No insert/delete policy: the one row is seeded above and only ever updated.

-- ── The assistant's "already asked" state for a visitor's name ─────────────
-- Additive only: assistant_email_asked already has live production data from
-- tonight's launch and keeps its exact existing meaning and column.
alter table support_conversations
  add column if not exists assistant_name_asked boolean not null default false;

-- Supports the inbox's "Bot working" view filter.
create index if not exists idx_support_conv_assistant_active
  on support_conversations (assistant_state, assigned_to, status)
  where assistant_state = 'active';

-- ── The Desk permission ─────────────────────────────────────────────────────
insert into role_permissions (role, permission) values
  ('super_admin', 'support.manage_assistant'),
  ('admin',       'support.manage_assistant')
on conflict (role, permission) do nothing;
