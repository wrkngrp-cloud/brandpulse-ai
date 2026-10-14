# The Desk: BrandGauge's internal tool

| Field | Value |
|---|---|
| **Owner** | Emmanuel Femi-Adejobi |
| **Status** | Plan, nothing built |
| **Last updated** | 14 October 2026 |
| **Authoritative on** | Staff access, the support chat, and every internal admin surface |
| **Reads with** | `docs/scoreboard-and-leads.md` (the lead desk this extends), `CLAUDE.md`, PRD Document 5 Part B |

This is a working doc, not part of the PRD set. It describes three things that belong
together because they share one access model:

1. **Support chat.** Our own widget, in the product and on the marketing site, so customers
   and strangers can talk to us. We are not buying Intercom.
2. **The Desk.** The staff tool at `/admin`: accounts, activity, usage, credits, revenue,
   leads, adoption, and the support inbox.
3. **Super Admin.** Who on staff may use the Desk, what they may do in it, and what they did.

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

## 2. Decisions to lock before building

Same spirit as PRD Document 5 Part B. Decide these once.

| Decision | Why |
|---|---|
| The Desk lives in this app at `/admin`, not a separate deployment | The service client, `TOKEN_ENCRYPTION_KEY`, the Supabase factories and the Inngest registry are all here. A second app means a second copy of each. The cost is admin code sitting beside customer code, paid for with `requireStaff()` on every entry and one audited data layer. |
| Staff access is an allowlist in the same shape as `is_lead_desk()` | Document 5 warns against a third RLS pattern copied from the lead desk. `is_staff()` is the same security-definer, fixed `search_path` form. `lead_desk_admins` folds into it. |
| We build the support chat, we do not buy one | It is our own data, in our own tables, joinable to the account. A hosted widget cannot show the agent that this brand's BHI is 41 and their Meta connector expired on Tuesday. |
| Anonymous chat goes through a service-role route holding a visitor token | Same mechanism as `/survey/[id]`, `/ambassador/[token]` and `/go/[slug]`. Anon RLS is never opened on the chat tables. |
| We reach our customers by email and in-app notification only | `whatsapp_contacts` holds the *tenant's* customers under the tenant's consent. Messaging them from our admin tool would break the NDPR gate and the Model A consent regime. Not a grey area. |
| Every cross-tenant read and every staff action writes an audit row | The tool bypasses RLS on purpose. The log is what makes that defensible. |
| The Desk uses the existing token layer and primitives | No second design system, no new UI dependency. |
| Impersonation is deferred, and if built: read-only, time-boxed, consented, banner, audited | The alternative, staff silently browsing customer data, is hard to explain afterwards. |

---

## 3. Access model

### Tables

```sql
-- Staff: who may open the Desk at all.
create table staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  role         text not null default 'support'
               check (role in ('support','finance','engineer','admin','super_admin')),
  status       text not null default 'active'
               check (status in ('active','suspended')),
  invited_by   uuid references auth.users(id) on delete set null,
  invited_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

alter table staff enable row level security;

-- Staff see the roster, including who else has access. Writes are never from the
-- client: granting access happens through a super-admin route on the service client.
create policy staff_read on staff for select using (is_staff());

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
```

```sql
-- Every staff action, including reads of customer data.
create table staff_audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid not null references auth.users(id) on delete set null,
  action       text not null,         -- 'account.view' | 'message.send' | 'staff.grant' ...
  target_type  text,                  -- 'workspace' | 'lead' | 'conversation' | 'staff'
  target_id    text,
  workspace_id uuid references workspaces(id) on delete set null,
  summary      text,                  -- one line, readable in the activity feed
  meta         jsonb not null default '{}'::jsonb,
  ip_hash      text,
  created_at   timestamptz not null default now()
);
create index idx_audit_actor on staff_audit_log(actor_id, created_at desc);
create index idx_audit_target on staff_audit_log(target_type, target_id, created_at desc);

alter table staff_audit_log enable row level security;
-- Staff see their own trail. Super admins see everyone's. Nobody updates or deletes.
create policy audit_read on staff_audit_log
  for select using (actor_id = auth.uid() or is_super_admin());
```

### Role matrix

| Capability | support | finance | engineer | admin | super_admin |
|---|---|---|---|---|---|
| Support inbox, reply | yes | no | yes | yes | yes |
| Account list and detail | yes | yes | yes | yes | yes |
| Lead desk | yes | no | no | yes | yes |
| Send email or in-app message | yes | no | no | yes | yes |
| Usage and AI cost | summary | yes | yes | yes | yes |
| Revenue, subscriptions, invoices | no | yes | no | yes | yes |
| Ops health, job failures, re-run seeds | no | no | yes | yes | yes |
| Change a workspace plan | no | yes | no | yes | yes |
| Grant or revoke staff access | no | no | no | no | yes |
| See another person's activity | no | no | no | no | yes |

Enforced in one place: a `requireStaff(roles[])` helper that every `/admin` page and route
calls first, and a `src/lib/admin/` data layer that is the only code allowed to use the
service client for cross-tenant reads. It writes the audit row itself, so a new screen
cannot forget to.

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
  source        text not null default 'app'
                check (source in ('app','site','scoreboard','email')),
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
- **Office hours and expectations.** If nobody is on, the widget says when we will reply
  and takes an email address. A promise we keep beats a chat bubble that implies someone
  is watching at 2am.
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

Extend `/dashboard/leads` rather than replace it, and move it under `/admin/leads`.
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

## 7. Super Admin

A small surface at `/admin/super`, `super_admin` only.

- **Grant access.** Email, role. Writes `staff` through the service client, sends the
  invite by Resend, writes the audit row. If the address has no `auth.users` row yet, the
  grant waits and attaches on their first sign-in.
- **Revoke and suspend.** Suspend keeps the history and closes the door, which is what you
  want the day someone leaves. Delete is for a mistaken grant.
- **Role changes**, with the matrix in section 3 visible on the page so the effect of a
  change is readable before it is made.
- **Staff activity.** Per person: last seen, actions in the last 7 and 30 days, accounts
  viewed, messages sent, plan changes made, conversations handled, median first response
  time, open threads assigned. All of it from `staff_audit_log` and the support tables, so
  it costs nothing extra to build once the log exists.
- **The full audit feed**, filterable by person, action and account, exportable.
- **Two rules in the code.** A super admin cannot edit their own row, which stops the last
  one locking everyone out by accident. The first super admin is seeded by migration, not
  by a route.

Staff activity is a management tool, so say what it is for in the room: response times and
who touched which account. Not keystrokes.

---

## 8. Build order

| Phase | What | Rough size |
|---|---|---|
| **0. Instrumentation** | `ai_calls`, `feature_events`, write `usage_events`, `staff_audit_log`, the Upstash plus Inngest flush | 1 session. Useful alone: the day `callAi` logs tokens we know what the product costs to run. |
| **1. Access and shell** | `staff`, `is_staff()`, `is_super_admin()`, `requireStaff()`, `/admin` shell and nav, `src/lib/admin/` data layer, fold in `lead_desk_admins` | 1 session |
| **2. Accounts** | List, detail, timeline, connectors, usage | 2 sessions |
| **3. Support chat** | Tables, service route, widget in app and site, Desk inbox, Resend out and in | 2 to 3 sessions. The biggest single piece. |
| **4. Super Admin** | Grants, roles, staff activity, audit feed | 1 session |
| **5. Money** | `subscriptions`, `invoices`, manual entry, revenue screens | 1 session |
| **6. Adoption** | Module registry, the recommendation engine, the blocked list | 1 to 2 sessions |
| **7. Later** | AI reply assist, Slack notifications, impersonation if we decide to | unscheduled |

Phases 2 and 3 can swap if support is the sharper pain. Phase 0 cannot move.

---

## 9. Open questions

1. Live chat or a reply promise at launch? Live chat with nobody watching it is worse than
   a form that says "within 4 hours".
2. Does revenue go in by hand before Paystack subscriptions exist, or do we wait?
3. Impersonation: defer, or build it with the consent gate?
4. Who is on the staff roster at launch, with which roles?
5. Chat attachments, yes or no? Screenshots make support far better and mean a Storage
   bucket with its own access rules.
6. Does the widget appear on `/scoreboard`? That is our highest-intent stranger traffic and
   also our noisiest.
