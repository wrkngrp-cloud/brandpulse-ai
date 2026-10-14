# The Desk: BrandGauge's internal tool

| Field | Value |
|---|---|
| **Owner** | Emmanuel Femi-Adejobi |
| **Status** | Plan, nothing built |
| **Last updated** | 14 October 2026 |
| **Authoritative on** | Staff access, the support chat, and every internal admin surface |
| **Lives at** | `desk.brandgauge.app`, served from this app at the `/desk` path |
| **Reads with** | `docs/scoreboard-and-leads.md` (the lead desk this extends), `CLAUDE.md`, PRD Document 5 Part B |

This is a working doc, not part of the PRD set. It describes three things that belong
together because they share one access model:

1. **Support chat.** Our own widget, in the product and on the marketing site, so customers
   and strangers can talk to us. We are not buying Intercom.
2. **The Desk.** The staff tool at `desk.brandgauge.app`: accounts, activity, usage,
   credits, revenue, leads, adoption, and the support inbox.
3. **Super Admin.** Staff accounts, invites, roles, per-module permissions, dataset access,
   and what each person did.

---

## 1. What we can build on, and what is missing

Worth being exact about this, because most of the screens below are easy and the telemetry
behind them does not exist.

### Already in the repo

| Thing | Where | Use to us |
|---|---|---|
| Allowlist access pattern | `lead_desk_admins`, `is_lead_desk()`, `/dashboard/leads` | The shape the staff table copies. Already the one sanctioned non-workspace RLS scope. |
| Leads with context | `leads`, `public_scans` | The prospect side of the inbox. Scan, rivals, share of reach, status. |
| Transactional email | Resend, in six Inngest jobs | Outbound mail and email fallback for chat. |
| In-app messaging | `notifications` table plus the bell | Staff can put a message inside a customer's product with one insert. |
| Realtime | Supabase Realtime, used in `src/components/events/live-dashboard.tsx` | Live chat transport for signed-in users. |
| Industry logic | `brand_type` on `brands`, `industry-config.ts`, `BRAND_TYPE_WEIGHTS` in `bhi.ts` | Makes "what should they be using" a calculation. |
| Module list | `dashboard-nav.tsx` (about 40 modules), `src/lib/tour-definitions.ts` | Becomes the adoption registry. |
| Marketing site | `src/app/page.tsx`, `/features`, `/use-cases`, `/scoreboard` | Same repo, so one chat widget serves product and site. |

### Missing

| Gap | Evidence | Consequence |
|---|---|---|
| No usage telemetry | `usage_events` is read by `settings/billing/page.tsx` and written by nothing in `src` | Every "AI calls this month" figure in the product is zero by construction |
| No AI cost record | `callAi` discards `resp.usage` | We cannot say what an account costs us |
| No feature usage record | nothing writes page or module views | "Which features do they use" is unanswerable |
| No subscriptions of our own | `plan` is a text column on `workspaces`, Stripe inert, Paystack decided but unbuilt | No MRR, no churn, no ARPA |
| No support record | no threads, no tickets, no sent-message log | Support is someone's inbox |
| No staff audit log | nothing | A tool that bypasses RLS by design, with no record of who read what |

**So Phase 0 is instrumentation.** The screens render themselves once the events exist.

---

## 2. Locked decisions

Same spirit as PRD Document 5 Part B. All of these are settled. Changing one is a
deliberate act, not a tidy-up.

| Decision | Why |
|---|---|
| The Desk answers on its own host, `desk.brandgauge.app`, served from this one app and one deploy | A separate deployment means a second copy of the service client, `TOKEN_ENCRYPTION_KEY`, the Supabase factories and the Inngest registry. Host routing gives the separation that matters (own URL, own login, own session cookie, nothing about the Desk reachable from the customer app) at the cost of one middleware rule. See section 2b. |
| The Desk is invite-only with its own login, email and password, no Google button, no signup route | Staff access is granted by a person, never self-served. A signup form on the Desk host is the whole security model undone. |
| Permissions are per module action and per dataset, not a fixed role | A support agent needs the account timeline and not the revenue figures. Finance needs the revenue and not the customer's survey text. Roles are templates over the same permission keys, so a new role is configuration rather than a deploy. |
| Staff access is an allowlist in the same shape as `is_lead_desk()` | Document 5 warns against a third RLS pattern copied from the lead desk. `is_staff()` is the same security-definer, fixed `search_path` form. `lead_desk_admins` folds into it. |
| We build the support chat, we do not buy one | It is our own data, in our own tables, joinable to the account. A hosted widget cannot show the agent that this brand's BHI is 41 and their Meta connector expired on Tuesday. |
| Anonymous chat goes through a service-role route holding a visitor token | Same mechanism as `/survey/[id]`, `/ambassador/[token]` and `/go/[slug]`. Anon RLS is never opened on the chat tables. |
| We reach our customers by three channels only: email, the in-app notification bell, and the chat widget in the product and on the site | `whatsapp_contacts` holds the *tenant's* customers under the tenant's consent. Messaging them from our admin tool would break the NDPR gate and the Model A consent regime. Not a grey area. |
| Every cross-tenant read and every staff action writes an audit row | The tool bypasses RLS on purpose. The log is what makes that defensible. |
| The Desk uses the existing token layer and primitives | No second design system, no new UI dependency. |
| Live chat, with staffed hours shown honestly | Decided. A real conversation while the customer is still on the page is worth more than any ticket form. The widget shows who is on and what the reply time is when nobody is, so the promise matches the staffing. |
| Impersonation is built, with a consent gate: the customer approves, the session is read-only, time-boxed and audited, and the tenant UI carries a banner throughout | Decided. Section 7 has the mechanism. Staff silently browsing customer data is the thing the gate exists to prevent. |
| Chat attachments are allowed, in a private bucket with signed URLs | Decided. A screenshot usually ends the diagnosis in one message. Unlike `brand-assets` and `campaign-creatives`, this bucket is not public: a support screenshot can hold anything. |
| The widget appears on every free public tool, scoreboard included | Decided. Highest-intent stranger traffic we have. The `source` field keeps that queue separable from paying customers. |

---

## 2b. How the Desk gets its own address

One app, one deploy, two hosts.

```
desk.brandgauge.app/*          ->  rewritten to /desk/*        (staff)
brandgauge.app/*               ->  served as today             (customers and site)
brandgauge.app/desk/*          ->  404                         (the path is not a back door)
desk.brandgauge.app/dashboard  ->  404                         (the Desk host serves nothing else)
```

Both rules live in `src/proxy.ts`, which already runs on every request. It reads
`DESK_HOST` from the environment, rewrites that host onto `/desk`, and refuses the
crossings in both directions.

**Setting it up, in order:**

1. Build at `/desk` and preview on the Vercel deployment URL we already have live.
   The path is real, so `https://<current-deployment>.vercel.app/desk` works from the
   first commit with no DNS and no new project.
2. When it is worth showing: Vercel project, Settings, Domains, add
   `desk.brandgauge.app`.
3. At the registrar holding `brandgauge.app`, one DNS record: `CNAME desk` pointing to
   `cname.vercel-dns.com`. Vercel issues the certificate itself.
4. Set two environment variables: `DESK_HOST=desk.brandgauge.app` and
   `NEXT_PUBLIC_DESK_URL=https://desk.brandgauge.app`, the second for invite links and
   email footers.
5. The host rewrite turns on by itself once `DESK_HOST` is set. The `/desk` path on the
   main host closes at the same moment, so there is no window where both work.

Preview deployments keep working throughout, because a Vercel preview URL is not
`DESK_HOST` and so falls back to the path. That is the point of doing it this way.

**Session separation.** Supabase writes its auth cookie host-only, with no `Domain`
attribute, so a staff session on `desk.brandgauge.app` is not sent to `brandgauge.app`
and a customer session is not sent to the Desk. Signing in to one does not sign you in to
the other, which is the behaviour we want, and it costs nothing to get.

---

## 3. Staff accounts and access

Nobody reaches the Desk by having an account on BrandGauge. Staff accounts are made by
invitation, hold a real profile, and carry permissions per module action and per dataset.

### 3.1 Tables

```sql
-- A staff member. One row per person with Desk access.
create table staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  full_name    text not null,
  job_title    text,
  phone        text,
  avatar_url   text,
  timezone     text not null default 'Africa/Lagos',
  role         text not null references staff_roles(name),
  status       text not null default 'active'
               check (status in ('active','suspended')),
  invited_by   uuid references auth.users(id) on delete set null,
  invited_at   timestamptz not null default now(),
  joined_at    timestamptz,
  last_seen_at timestamptz,
  last_sign_in_ip_hash text
);

-- Roles are templates over permission keys, editable in the Desk.
create table staff_roles (
  name        text primary key,          -- 'support' | 'bizdev' | 'finance' | 'engineer' | 'admin' | 'super_admin'
  label       text not null,
  description text,
  is_system   boolean not null default false   -- system roles cannot be deleted
);

create table role_permissions (
  role       text not null references staff_roles(name) on delete cascade,
  permission text not null,
  primary key (role, permission)
);

-- Per person, on top of their role. A deny always wins, so one person can be
-- trusted with one extra screen, or kept out of one, without inventing a role.
create table staff_permission_overrides (
  user_id    uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  effect     text not null check (effect in ('grant','deny')),
  set_by     uuid references auth.users(id) on delete set null,
  set_at     timestamptz not null default now(),
  primary key (user_id, permission)
);

-- An invitation. The token is stored hashed, used once, and expires.
create table staff_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  full_name   text,
  role        text not null references staff_roles(name),
  token_hash  text not null unique,      -- sha256 of a 32-byte random token
  invited_by  uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_staff_invites_email on staff_invites(lower(email));
```

All five get RLS on. `staff` and `staff_roles` are readable by staff so the roster and the
role list can be shown. `role_permissions`, `staff_permission_overrides` and
`staff_invites` are readable only by a super admin. None of them is writable from the
client: every change goes through a Desk route on the service client that checks the
permission and writes the audit row.

### 3.2 The three functions

```sql
create or replace function is_staff()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.status = 'active'
  );
$$;

create or replace function is_super_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid() and s.status = 'active' and s.role = 'super_admin'
  );
$$;

-- The one permission check. A super admin holds everything; a deny override beats a
-- role grant; otherwise the role decides.
create or replace function staff_can(perm text)
returns boolean language sql security definer stable
set search_path = public as $$
  with me as (
    select s.user_id, s.role from public.staff s
    where s.user_id = auth.uid() and s.status = 'active'
  )
  select case
    when not exists (select 1 from me) then false
    when (select role from me) = 'super_admin' then true
    when exists (select 1 from public.staff_permission_overrides o
                 where o.user_id = (select user_id from me)
                   and o.permission = perm and o.effect = 'deny') then false
    when exists (select 1 from public.staff_permission_overrides o
                 where o.user_id = (select user_id from me)
                   and o.permission = perm and o.effect = 'grant') then true
    else exists (select 1 from public.role_permissions rp
                 where rp.role = (select role from me) and rp.permission = perm)
  end;
$$;
```

`is_lead_desk()` and `lead_desk_admins` fold into this. The existing lead desk check
becomes `staff_can('leads.view')`, and the old table is dropped in the same migration
after its rows are copied across.

### 3.3 Permission keys

Two groups in one namespace, so the Desk can show them as two lists.

**Actions, by module:**

| Module | Keys |
|---|---|
| Accounts | `accounts.view`, `accounts.note`, `accounts.message`, `accounts.plan_change`, `accounts.impersonate` |
| Support | `support.view`, `support.reply`, `support.assign`, `support.close` |
| Leads | `leads.view`, `leads.edit`, `leads.export` |
| Usage | `usage.view` |
| Revenue | `revenue.view`, `revenue.edit`, `revenue.export` |
| Adoption | `adoption.view` |
| Ops | `ops.view`, `ops.run_job`, `ops.reseed` |
| Staff | `staff.view`, `staff.invite`, `staff.revoke`, `staff.permissions`, `staff.activity` |

**Datasets**, which gate what a screen is allowed to render rather than what it does:

| Key | What it unlocks |
|---|---|
| `data.customer_email` | Member and lead email addresses. Without it, addresses render masked. |
| `data.customer_phone` | Phone numbers. Hashed values in `whatsapp_send_log` stay hashed regardless. |
| `data.customer_content` | Survey responses, mentions, uploaded creative, AI outputs. |
| `data.ai_cost` | Our cost per account and per call. |
| `data.revenue_figures` | Amounts on subscriptions and invoices. |
| `data.audit_all` | Other people's activity, not just your own. |

So a support agent with `accounts.view` and `data.customer_email` but not
`data.revenue_figures` sees the whole account timeline with the money redacted, and the
redaction happens in the data layer rather than in the component.

### 3.4 Default role templates

Six roles seeded by migration, editable afterwards in the Desk. **Business development**
(`bizdev`) owns the pipeline: the whole lead desk, accounts with notes and outbound
messages, adoption so they can see what an account is not using, plan and price visible
but not editable, and no customer content, because reading a customer's survey responses
is not a sales job.

| | support | bizdev | finance | engineer | admin | super_admin |
|---|---|---|---|---|---|---|
| Accounts: view / note / message | yes | yes | view | view | yes | all |
| Accounts: change plan | no | no | yes | no | yes | all |
| Accounts: impersonate | no | no | no | yes | yes | all |
| Support: view / reply / assign / close | yes | view, reply | no | view | yes | all |
| Leads | view, edit | all | no | no | all | all |
| Usage | yes | yes | yes | yes | yes | all |
| Revenue | no | view | view, edit, export | no | view | all |
| Adoption | yes | yes | no | yes | yes | all |
| Ops | no | no | no | yes | yes | all |
| Staff management | no | no | no | no | no | yes |
| `data.customer_email` | yes | yes | yes | yes | yes | yes |
| `data.customer_phone` | no | yes | no | no | yes | yes |
| `data.customer_content` | yes | no | no | yes | yes | yes |
| `data.ai_cost` | no | no | yes | yes | yes | yes |
| `data.revenue_figures` | no | yes | yes | no | yes | yes |
| `data.audit_all` | no | no | no | no | no | yes |

### 3.5 Enforcement, in one place

- `requireStaff('accounts.view')` at the top of every Desk page and route. It resolves the
  session, checks `staff_can`, writes the audit row, and returns the staff record with its
  full permission set.
- `src/lib/desk/` is the only code allowed to use the service client for cross-tenant
  reads. It takes the permission set and redacts by dataset key before returning rows, so
  a new screen cannot leak a field by forgetting to check.
- The middleware refuses `/desk` to anyone with no active `staff` row before a page ever
  renders.

### 3.6 Invite, suspend, remove

**Invite.** Super admin enters email, full name, role. We create a `staff_invites` row
with a hashed single-use token and a 72-hour expiry, and send the link with Resend from our
own template, so the copy follows the Voice rule like any other message we send.

**Accept.** The link opens `/desk/invite/[token]`. The page shows the address it was sent
to, and asks for a password, job title and timezone. The accept route, on the service
client, checks the hash, the expiry and that it has not been used, then creates the auth
user with `auth.admin.createUser({ email, password, email_confirm: true })`, inserts the
`staff` row, stamps `accepted_at`, and writes the audit row. If that address already has a
BrandGauge account, no new user is created, the existing one is linked and their password
is left alone.

**Sign in.** `/desk/login`, email and password through the existing
`signInWithPassword`, which the customer app already uses. No signup link, no Google
button, no password field on the Desk host that creates anything. Rate limited by IP in
Upstash, and every attempt, success or failure, writes an audit row.

**Suspend.** Flip `status` to `suspended`. `is_staff()` goes false on the next request, so
access stops at once while the person's history and their support threads stay attached to
them. This is what to use the day someone leaves.

**Remove.** Delete the `staff` row. Their audit trail survives, because
`staff_audit_log.actor_id` holds a user id and not a staff id. Deleting the underlying
auth user is a separate and rarer act, and the Desk refuses it if that address also
belongs to a customer workspace, which it checks first.

**Two rules in the code.** A super admin cannot change or suspend their own row, so the
last one cannot lock everyone out by accident. The first super admin is seeded by
migration, never by a route.

---

### 3.7 The audit log

```sql
create table staff_audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id) on delete set null,
  action       text not null,         -- 'account.view' | 'message.send' | 'staff.invite' ...
  target_type  text,                  -- 'workspace' | 'lead' | 'conversation' | 'staff'
  target_id    text,
  workspace_id uuid references workspaces(id) on delete set null,
  summary      text,                  -- one readable line for the activity feed
  meta         jsonb not null default '{}'::jsonb,
  ip_hash      text,
  created_at   timestamptz not null default now()
);
create index idx_audit_actor on staff_audit_log(actor_id, created_at desc);
create index idx_audit_target on staff_audit_log(target_type, target_id, created_at desc);

alter table staff_audit_log enable row level security;
-- Your own trail, or everyone's with the dataset key. No update, no delete, ever.
create policy audit_read on staff_audit_log
  for select using (actor_id = auth.uid() or staff_can('data.audit_all'));
```

Written by `requireStaff` and by the `src/lib/desk/` data layer, not by each screen. Reads
of customer data are logged as well as writes, because a tool that bypasses RLS by design
needs to be able to answer who looked at what.

---

## 4. The support chat

One widget, two audiences, one inbox.

### Identity

| Visitor | Identified by | Transport |
|---|---|---|
| Signed-in user in the product | `auth.uid()`, workspace and active brand attached | Supabase Realtime subscription, RLS does the scoping |
| Stranger on the marketing site | `visitor_token`, random, httpOnly cookie, long TTL | Service-role route, widget polls every 4 seconds while open |

A stranger who later gives an email, or signs up with the same address, gets their old
thread attached to the new account by a nightly reconciliation on `lower(email)`. That is
how a pre-sales conversation stays attached to the customer it became, which is the thing
hosted tools are good at and we would otherwise lose.

### Tables

```sql
create table support_conversations (
  id            uuid primary key default gen_random_uuid(),
  -- Null for a stranger. Set on sign-up or when staff attach the thread.
  workspace_id  uuid references workspaces(id) on delete set null,
  brand_id      uuid references brands(id)     on delete set null,
  user_id       uuid references auth.users(id) on delete set null,
  -- The anonymous path. Random, cookie-held, the only credential a stranger has.
  visitor_token text unique,
  email         text,
  name          text,
  subject       text,
  status        text not null default 'open'
                check (status in ('open','pending','snoozed','closed')),
  priority      text not null default 'normal'
                check (priority in ('low','normal','high','urgent')),
  assigned_to   uuid references auth.users(id) on delete set null,
  -- Where they were standing when they asked. The single most useful support field.
  -- Where the thread started. 'tool' covers the free public tools beyond the
  -- scoreboard, so that queue stays separable from paying customers.
  source        text not null default 'app'
                check (source in ('app','site','scoreboard','tool','email')),
  page_url      text,
  user_agent    text,
  first_response_at timestamptz,
  last_message_at   timestamptz not null default now(),
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index idx_support_conv_status on support_conversations(status, last_message_at desc);
create index idx_support_conv_ws on support_conversations(workspace_id, last_message_at desc);
create index idx_support_conv_email on support_conversations(lower(email));

create table support_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references support_conversations(id) on delete cascade,
  -- 'customer' | 'staff' | 'system' (status changes, assignment, the auto-greeting)
  author_type     text not null check (author_type in ('customer','staff','system')),
  author_id       uuid references auth.users(id) on delete set null,
  body            text not null,
  attachments     jsonb not null default '[]'::jsonb,   -- Supabase Storage paths
  -- Staff-only note on the thread, never shown to the customer.
  internal        boolean not null default false,
  read_by_customer_at timestamptz,
  read_by_staff_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_support_msg_conv on support_messages(conversation_id, created_at);
```

RLS on both: a signed-in customer reads and writes their own workspace's conversations
through `is_workspace_member()`, and never sees a row where `internal = true`. Staff read
and write everything through `is_staff()`. Strangers have no policy at all, because they
have no `auth.uid()`: their path is `/api/support/thread` on the service client, which
validates the `visitor_token` and filters by it. One token, one thread, nothing else
reachable. Same posture as the survey and ambassador routes.

### Behaviour

- **Widget.** One client component, mounted in the dashboard shell and in the marketing
  layout. Closed state is a button, open state is a thread. Unread count on the launcher.
  Built from the existing primitives so it looks like the product and not like a bolt-on.
- **Context packet.** When a signed-in user opens a thread we attach workspace, brand,
  `brand_type`, plan, current BHI and the page they were on. The agent sees it in the Desk
  beside the first message, so nobody has to ask "which account is this".
- **Live, with honest presence.** Staff presence comes from `staff.last_seen_at` inside a
  5-minute window, filtered to people holding `support.reply`. On, the widget says someone
  is here and shows the agent's name and photo once they join. Off, it says when we will
  reply, takes an email address, and the thread waits in the inbox. The widget never
  implies someone is watching at 2am.
- **Live means live.** Customer messages arrive over Realtime and so do ours. Typing
  indicators and read receipts go on a Realtime broadcast channel keyed by conversation,
  not in Postgres, because nobody needs a durable record of a typing indicator.
- **Attachments.** Images and PDFs up to 10MB, in a private `support-attachments` bucket.
  Uploads go through `/api/support/attachment` on the service client, which checks either
  the session or the visitor token, writes the path into `support_messages.attachments`,
  and never trusts a path supplied by the client. Reads are 60-second signed URLs minted
  per view. The bucket is private, in contrast to the two existing public buckets, because
  a support screenshot can contain anything.
- **Email fallback.** Staff reply lands as an in-app message if they are signed in, and as
  a Resend email if the thread has been quiet for 10 minutes or came from the site.
  Replies to that email come back into the thread through a Resend inbound webhook,
  signature verified, matched on a thread id in the reply-to address.
- **Notifications.** A new customer message pings staff, by email now and Slack later. A
  staff reply writes a `notifications` row so the bell lights up in the product.
- **AI assist, Phase 5, not before.** `callAi` on the `structural` tier, reading our own
  docs and the account's state, drafting a reply for a human to send. Suggest, never
  auto-send, and no model name anywhere in the UI. An auto-answering bot on a product
  people pay for to get real analysis is the wrong trade.

### What this gives the Desk that a hosted tool cannot

Thread opened from `/dashboard/funnel`, on a `b2b_saas` brand, plan `growth`, BHI 41,
GA4 connector last synced 19 days ago, AI calls this month 2. The question "why is my
funnel empty" answers itself before the agent types.

---

## 5. The Desk

### 5.1 Accounts

**List.** Workspace, plan, brand types, seats, created, last active, adoption score,
AI spend month to date, connectors live, open conversations. Sort by last active and the
quiet accounts surface themselves.

**Detail.** One page:

- **Timeline.** Signups, connector connected or revoked, first BHI computed, surveys sent,
  AI calls, support threads, plan changes. Almost all of it is assembling rows we already
  store. This is the screen that turns support from guessing into reading.
- **Connectors.** Real state per connector, including Inert ones blocked on a missing
  credential, and last sync time. Never the token, not even masked.
- **Usage and spend.** Calls by tier and by feature, against `plan_limits`, plus our cost.
- **Adoption.** Modules used, modules they should be using (section 5.5).
- **People.** Members, roles, last seen.
- **Money.** Subscription, invoices, lifetime value, gross margin after AI cost.
- **Actions.** Send email, send in-app message, change plan, add note, open a thread.

### 5.2 Support inbox

Queue filtered by status, assignment and source. Thread view with the context packet,
internal notes, canned replies, assignment, snooze. First response time and resolution
time per thread, which is also how staff performance gets measured in Super Admin.

### 5.3 Leads

Extend `/dashboard/leads` rather than replace it, and move it under `/desk/leads`.
One real gap to close: `signed_up` is a manual boolean, so a nightly job joins
`leads.email` against `auth.users` and sets it. Then conversion by referrer and by
scanned category is a number rather than a feeling.

### 5.4 Revenue

MRR, plan mix, new, expansion, contraction, churn, ARPA, and gross margin once AI cost is
subtracted. Built on the subscription tables in section 6, which can be filled by hand
before Paystack lands.

### 5.5 Adoption, and what they should be using

The part that earns its keep, because it falls out of what we already encode:

```
for each module in the registry:
  relevant = not hidden for this industry, and sensible for this brand_type
  ready    = its connector or data prerequisite is satisfied
  unused   = no feature_event in 30 days
  weight   = the BHI weight of the signal this module feeds, for this brand_type

recommend = relevant and ready and unused, ranked by weight
blocked   = relevant and not ready            -> the onboarding queue
```

It reads out as: "this fintech's BHI is held down by an empty cultural component, weighted
0.15 for their brand type, and nobody has opened Cultural Insights since signup." That is
a renewal conversation generated from data. The `blocked` list is the connector chase.

### 5.6 Ops health

Inert connectors across all accounts, failing Inngest jobs, stale syncs, seed state of the
four demo accounts, scoreboard feed health. Engineer and admin roles only.

---

## 6. Telemetry and money tables

```sql
-- Every call through callAi. One write inside the wrapper instruments the whole product.
create table ai_calls (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references workspaces(id) on delete cascade,
  brand_id      uuid references brands(id)     on delete set null,
  user_id       uuid references auth.users(id) on delete set null,
  tier          text not null,     -- cultural | structural | chat | boardGrade
  model         text not null,     -- recorded for cost maths, never shown in any UI
  feature       text not null,     -- 'funnel.diagnose', 'report.monthly', ...
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric(10,6),
  latency_ms    integer,
  ok            boolean not null default true,
  error         text,
  created_at    timestamptz not null default now()
);
create index idx_ai_calls_ws_month on ai_calls(workspace_id, created_at desc);

-- Module usage, rolled up. Never one row per page view.
create table feature_events (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id     uuid references brands(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  module       text not null,            -- key from the module registry
  day          date not null,
  count        integer not null default 1,
  primary key (workspace_id, module, day, user_id)
);

create table subscriptions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  plan            text not null references plan_limits(plan),
  status          text not null default 'active'
                  check (status in ('trialing','active','past_due','cancelled')),
  amount_ngn      integer not null default 0,
  interval        text not null default 'month' check (interval in ('month','year')),
  provider        text not null default 'manual'
                  check (provider in ('manual','paystack')),
  provider_ref    text,
  current_period_start date,
  current_period_end   date,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now()
);

create table invoices (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid references subscriptions(id) on delete set null,
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  amount_ngn      integer not null,
  status          text not null check (status in ('draft','sent','paid','failed','refunded')),
  provider_ref    text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);
```

All five get RLS. `ai_calls`, `feature_events`, `subscriptions` and `invoices` are readable
by workspace members for their own rows (the billing page needs them) and by staff through
`is_staff()`. Writes are service role only.

**Paystack subscriptions: built, not connected.** The handler ships with the tables, at
`/api/billing/paystack/webhook`, separate from `/api/webhooks/paystack`, which is the
tenant's own customer payments and a different job entirely. It verifies the HMAC sha512
signature against `PAYSTACK_SECRET_KEY` with `crypto.timingSafeEqual`, fails closed when
that variable is unset, and handles `subscription.create`, `subscription.disable`,
`charge.success`, `invoice.create`, `invoice.update` and `invoice.payment_failed`, writing
into `subscriptions` and `invoices`. Nothing is registered in the Paystack dashboard until
you choose to, and until then the same tables are filled by hand from the Desk, so the
revenue screens work from day one. Switching it on later is one URL in a dashboard and one
environment variable, with no code change and no migration.

**Where the events come from:**

- `ai_calls`: inside `callAi`, after the Anthropic call returns, reading `resp.usage`.
  One change, every AI feature instrumented, which is only possible because Document 5
  locks every call to that wrapper.
- `usage_events`: start writing the three types the billing page already reads
  (`ai_call`, `survey_response`, `portal_view`).
- `feature_events`: `src/proxy.ts` is the only place that sees every dashboard navigation.
  Increment an Upstash counter there, fire and forget, and flush hourly into Postgres with
  an Inngest job. Middleware stays fast and Postgres sees one upsert per workspace, module
  and hour.

---

## 7. Impersonation, with the consent gate

Read-only, asked for, time-boxed, visible, logged. Five properties, each one load-bearing.

```sql
create table impersonation_sessions (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  -- Who approved, and the thread or ticket the request came out of.
  requested_for uuid references auth.users(id) on delete set null,
  conversation_id uuid references support_conversations(id) on delete set null,
  reason        text not null,
  status        text not null default 'pending'
                check (status in ('pending','approved','declined','active','ended','expired')),
  approved_by   uuid references auth.users(id) on delete set null,
  approved_at   timestamptz,
  started_at    timestamptz,
  -- Hard stop. Nothing extends a session; staff ask again.
  expires_at    timestamptz,
  ended_at      timestamptz,
  pages_viewed  integer not null default 0,
  created_at    timestamptz not null default now()
);
create index idx_imp_ws on impersonation_sessions(workspace_id, created_at desc);
```

**The flow.**

1. Staff asks from the account page or a support thread, holding
   `accounts.impersonate`, and types a reason. No reason, no request.
2. The customer gets it in two places: the chat thread it came from, and a notification
   in their product. The request names the person, their reason, and the 30-minute
   window. An owner or admin of the workspace approves or declines. Nobody else can.
3. On approval the session goes `active` and staff get a read-only view of that
   workspace's dashboard, scoped by a server-side session that resolves the active
   workspace to theirs. The Desk never hands the browser a customer token.
4. **Read-only is enforced server-side, not by hiding buttons.** While a session is
   active, every mutating route refuses the request. The check sits in the same place that
   resolves the impersonation, so a route cannot opt out of it by being new.
5. A banner sits at the top of every page for the whole session, naming the staff member
   and the time left, with an End button that the customer can press. Staff see the same
   banner. Nobody is in any doubt about what is happening.
6. It ends on the customer's End, on the staff member's End, or at `expires_at`, whichever
   comes first. An Inngest job sweeps anything stranded.
7. Every page view writes an audit row with the path. The account page shows the whole
   history of who looked, when, why, and with whose approval. The customer can see that
   list too, which is the part that makes the feature honest.

**Two refusals in the code.** No impersonation without an approval row, so there is no
super-admin override for "just this once". And a session cannot be opened on a workspace
with no owner or admin who could have approved it.

---

## 8. Super Admin

A section of the Desk at `/desk/staff`, gated on the `staff.*` keys, which only the
super_admin role holds by default.

- **Roster.** Everyone with access: name, job title, role, status, last seen, open threads
  assigned. One row per person, with their photo if they uploaded one.
- **Invite.** Email, full name, role. Sends the link, shows the invite as pending with its
  expiry, and lets you resend or revoke it before it is used.
- **Person page.** Their profile, their role, their overrides, and their activity.
  Changing a role shows the permission diff before you save it, so the effect is readable
  rather than guessed.
- **Permissions editor.** The two lists from section 3.3, as checkboxes, at two levels:
  the role template, which changes everyone holding that role, and the person, which
  grants or denies one key for one person. The editor says which level a given yes came
  from, because "why can she see this" needs to be answerable in one glance.
- **Roles editor.** Create a role, name it, tick its keys. New roles are configuration,
  not a deploy. System roles can be edited but not deleted.
- **Activity.** Per person: last seen, actions in the last 7 and 30 days, accounts viewed,
  messages sent, plan changes made, conversations handled, median first response time,
  open threads. All of it from `staff_audit_log` and the support tables, so it costs
  nothing extra once the log exists.
- **The full audit feed**, filterable by person, action, account and date, exportable.

Staff activity is a management tool, so say in the room what it is for: response times,
and who touched which account. Not keystrokes.

---

## 9. Build order

Everything is previewed at `<current-deployment>.vercel.app/desk` from phase 1 onward. The
subdomain goes live whenever you want it to, and changes nothing about the code.

| Phase | What | Rough size |
|---|---|---|
| **0. Instrumentation** | `ai_calls`, `feature_events`, write `usage_events`, `staff_audit_log`, the Upstash plus Inngest flush | 1 session. Useful alone: the day `callAi` logs tokens we know what the product costs to run. |
| **1. Staff access and shell** | `staff`, `staff_roles`, `role_permissions`, overrides, invites, the three SQL functions, `requireStaff`, `src/lib/desk/`, the host rewrite in `proxy.ts`, `/desk/login`, the invite and accept flow, the Desk shell and nav | 2 sessions. Nothing else can be built until a staff member can sign in. |
| **2. Super Admin** | Roster, invite, person page, permissions and roles editors, activity, audit feed | 1 to 2 sessions. Early on purpose: you need to be able to let someone in before there is anything for them to do. |
| **3. Accounts** | List, detail, timeline, connectors, usage, with dataset redaction | 2 sessions |
| **4. Support chat** | Tables, service route, the private attachment bucket, the widget in the app, on the site and on every free tool, live presence, the Desk inbox, Resend out and in | 3 sessions. The biggest single piece. |
| **5. Leads** | Move the lead desk across, retire `lead_desk_admins`, the nightly signed-up join | half a session |
| **6. Money** | `subscriptions`, `invoices`, manual entry, the Paystack handler left unregistered, revenue screens | 1 to 2 sessions |
| **7. Impersonation** | `impersonation_sessions`, request, approve, the read-only server guard, the banner, the sweep job, the history on both sides | 1 to 2 sessions. Last, because it is the one feature where a shortcut is a breach. |
| **8. Adoption** | Module registry, the recommendation engine, the blocked list | 1 to 2 sessions |
| **9. Later** | AI reply assist, Slack notifications, 2FA on staff accounts | unscheduled |

Phase 0 cannot move. Phases 1 and 2 are one piece of work in practice.

---

## 10. What is settled, and what is left

**Settled, 14 October 2026.** Live chat rather than a reply form. The widget on the
product, the marketing site, the scoreboard and every free tool we build after it. Chat
attachments, in a private bucket. Impersonation built with the consent gate. Six staff
roles with business development among them. The Desk on `desk.brandgauge.app`, previewed
at `/desk` on the deployment we already have live. Paystack subscription handling built
and left unregistered until you connect it.

**Left open.**

1. Staffed hours. The widget tells the truth about presence either way, but somebody has
   to decide what the promise is when nobody is on: 4 hours, same working day, or next
   working day.
2. Who is invited at launch, and on which roles.
3. Two-factor on staff accounts: at launch, or once there are more than three of us?
   Supabase supports TOTP, so it is a settings page rather than a build.
4. Whether a lead who never signs up should be reachable from the chat widget after the
   thread closes, which is a marketing consent question before it is a build question.
