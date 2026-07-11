# BrandPulse AI — Project Rules

This file is the contract for working in this repo. It is meant to be self-sufficient:
if you follow it, you should not need to guess how things are done here. When it and the
code disagree, the code wins and this file is wrong. Fix the file.

## What this is
Brand-intelligence SaaS for Nigerian / West African marketing teams, serving 7 verticals
(see `brand_type` below), not FMCG-only. It helps marketers measure brand health and
justify spend to management.

Read the PRD set in `../docs` (one level above this repo root: Document 1 Foundations,
2 Modules & Data, 3 Roadmap/Prompts/Risk, 4 Build Guide) before building any feature.
The schema is in Document 2; the per-phase build prompts are in Document 3. The PRDs are
not checked into git. This repo's own `docs/` folder holds supporting working docs only
(`industry-fit-strategy.md`, `funnel-signals-explained.md`, `to-100-percent-build-list.md`).
Those are not the PRD set.

## Commands
- `npm run dev` — local dev server (Next.js + Turbopack).
- `npm run build` — production build. Must pass before a change is done.
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`).
- `npx tsc --noEmit` — type-check the whole project. Must pass before a change is done.
- `supabase db push` — apply pending SQL migrations to the linked project. Run
  `supabase migration list` first to confirm only your migration is pending.
There is no unit-test suite. Verify behaviour by type-check + lint + driving the actual
flow (see Definition of done).

## Repo layout
- `src/app/**` — Next.js App Router. Pages are server components by default; API routes
  live in `src/app/api/**/route.ts`.
- `src/lib/**` — server-side logic: `ai/` (Claude client + prompt builders), `supabase/`
  (client factories), `inngest/` (background jobs), `crypto.ts`, `active-brand.ts`, `bhi.ts`,
  `industry-config.ts`, connector/social helpers.
- `src/components/**` — React components (client and server).
- `src/proxy.ts` — auth middleware: redirects unauthenticated users away from `/dashboard`
  and `/onboarding`. Public paths (`/survey`, `/go`, `/ambassador`, `/api/inngest`) are
  excluded in its matcher.
- `supabase/migrations/**` — SQL migrations, timestamp-named `YYYYMMDDHHMMSS_name.sql`.

## Stack (do not deviate without asking)
Next.js 16 App Router + TypeScript + Turbopack (default) · Supabase (Postgres + Auth +
Realtime + Storage) · Tailwind + shadcn/ui · Recharts (+ D3 for Sankey/connectors) ·
Zustand · React Hook Form + Zod · Anthropic Claude · Inngest for ALL background jobs ·
Upstash Redis for cache / rate-limit / OAuth state.

## Hard rules
- Multi-tenancy is enforced by RLS via `is_workspace_member()`. Never filter tenancy in
  app code as a substitute for RLS. See "Data access" for the one place this matters most.
- All AI and external-API calls are server-side. NEVER expose `ANTHROPIC_API_KEY`,
  `OPENAI_API_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Write the SQL migration BEFORE the API route that uses it.
- Every new table gets RLS enabled and a workspace-scoped policy in the same migration.
  See "Database and migrations". Use the `bp-supabase-rls` skill.
- Mark every component `"use client"` or leave it a server component, explicitly.
- Our own AI calls go through `src/lib/ai/client.ts` (`callAi`), Anthropic-only. Do not add
  NVIDIA NIM or any OpenAI-compatible generation call. The AI Visibility Tracker is the ONLY
  exception: it queries external LLMs (OpenAI/Gemini/Perplexity) as the thing being measured,
  not to generate our output. Never display a model name in any UI.
- Surveys deliver by email + in-app + WhatsApp + shareable link. NO SMS, NO USSD.
- OOH attribution = branded vanity link + UTM (primary), search-uplift (corroboration).
  Event attribution = ambassador-captured leads via the PWA. QR is a secondary toggle,
  off by default.
- Errors surface as sonner toasts. Loading uses shadcn skeletons. Everything is responsive
  from iPhone SE width up.
- Public endpoints (`/survey/[id]`, `/ambassador/[token]`, `/go/[slug]`) post/redirect via a
  service-role API route that validates the token/slug. NEVER open anon RLS on those tables.
- Brands carry a `brand_type` (fmcg | fintech | venue | b2b_saas | marketplace |
  beverage_alcohol | b2b_distribution). Any new funnel/BHI signal, nav item, or connector
  recommendation MUST branch on `brand_type` (see `src/lib/industry-config.ts` and
  `src/lib/bhi.ts` `BRAND_TYPE_WEIGHTS`) instead of assuming FMCG. Check
  `docs/industry-fit-strategy.md` before adding a signal that only makes sense for one vertical.
- Every dashboard module ships with a first-visit product tour (`data-tour` attributes + an
  entry in `src/components/tours/tour-definitions.ts`) and is reachable from the persistent
  topbar "Show me around" trigger. Add both when building a new module.

## Data access: RLS client vs service client (read this before touching any API route)
Two Supabase clients exist in `src/lib/supabase/server.ts`:
- `createClient()` — the RLS client. Runs as the signed-in user. Its queries are automatically
  scoped to the user's workspace by RLS. This is the DEFAULT. Use it for anything a logged-in
  user does to their own data.
- `createServiceClient()` — the service-role client. Bypasses RLS entirely. Use it ONLY for:
  webhooks, cron/Inngest jobs, public token-gated endpoints, and cross-tenant admin work.

Hard rule: when you use `createServiceClient()` in a request that a user triggers, you MUST
manually verify the caller owns the row you are reading or writing. A service-client query
filtered only by an id taken from the request body/params is a cross-tenant hole (this class
of bug was found and fixed across `brands/[id]` DELETE, `event/visual-scan`, and
`ai/survey-analysis` on 2026-07-11). The safe pattern: fetch/verify the row through the RLS
client first (or add `.eq('brand_id', <active brand>)`), then do service-role work.

## Active brand lookup (critical, always use this)
ALWAYS use `getActiveBrandId(supabase)` or `getActiveBrand<T>(supabase, 'col1, col2')`
from `src/lib/active-brand.ts` in every API route that needs the current brand. NEVER use
`.from('brands').select(...).limit(1).single()` — that ignores the `active_brand_id` cookie
and silently breaks multi-brand workspaces.

## Database and migrations
- One migration per change, named `YYYYMMDDHHMMSS_short_name.sql` (UTC timestamp so ordering
  is stable). Write it before the code that depends on it.
- Every new table: `alter table X enable row level security;` plus a policy that scopes rows
  to workspace members, in the same migration. The standard shape:
  `using (is_workspace_member((select workspace_id from brands where id = brand_id)))`
  or the `exists (select 1 from brands b where b.id = brand_id and is_workspace_member(b.workspace_id))`
  form used in the initial schema. Reference-only tables that hold no tenant data still get RLS
  on with an authenticated-read policy so the public anon key cannot write them.
- Apply with `supabase db push`. The CLI is authenticated via `SUPABASE_ACCESS_TOKEN` and
  linked to the project; port 5432 to the pooler occasionally i/o-times-out, just retry.
- Store OAuth / connector tokens ENCRYPTED with `encrypt()` from `src/lib/crypto.ts`
  (AES-256-GCM). Never store access/refresh tokens in plaintext. `TOKEN_ENCRYPTION_KEY` is
  required in production.

## AI features and model routing
The tier→model mapping is defined in `src/lib/ai/client.ts` `MODELS` and that file is the
single source of truth. Do not hardcode model IDs anywhere else and do not restate the IDs
in this doc (they drift). Route by tier, not by model name:
- `cultural` — sentiment, Pre/Post widget, anything touching Pidgin/Yoruba/Igbo/Hausa.
- `structural` — reports, competitive briefings, funnel diagnosis, general AI answers.
- `chat` — the AI Command Layer.
- `boardGrade` — executive business cases.
Call via `callAi({ tier, system, messages, maxTokens?, temperature? })`. Set
`export const runtime = 'nodejs'` and a sensible `maxDuration` on routes that call AI.
Cache the Layer-1 brand context. Build prompts with the `bp-ai-prompt` skill (mandatory
3-layer + cultural block). AI responses that must be JSON should extract the `{...}` block
robustly, not `JSON.parse(raw.trim())`, and use a token budget large enough for the full
structured response.

## External integrations (OAuth, webhooks)
- OAuth connect routes generate a random `state`, store it in Upstash Redis with a short TTL
  (`ex: 600`) or an httpOnly cookie, and the callback verifies-then-consumes it. Follow the
  existing ads/social/GA4 routes; do not skip state validation.
- Every webhook verifies its signature before doing any work: Paystack (HMAC sha512),
  Flutterwave (timing-safe secret compare), Meta/WhatsApp Cloud (HMAC sha256, timing-safe),
  Stripe (`constructEvent`). Providers that do not sign (Africa's Talking) are authenticated
  with a shared secret in the callback URL / header, fail-closed when the secret env var is unset.
- Admin/seed endpoints are gated by the `ADMIN_SECRET` env var (sent as `x-seed-secret`),
  fail-closed if unset. Never hardcode a secret in source.

## WhatsApp Deep Integration — Model A (Phase 4)
Architecture: BrandPulse-owned WABA. All sends originate from BrandPulse's own WhatsApp
Business number. Users manage contacts and templates inside BrandPulse UI only; they never
touch an API key or external platform.
API: Meta Cloud API v20.0.
Send endpoint: POST `https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages`.
Webhook: POST `/api/whatsapp/webhook` (delivery status: sent/delivered/read/failed), HMAC-verified.
Env vars (server-side only): `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`,
`WHATSAPP_ACCESS_TOKEN` (permanent system-user token, never a page token).
Rules:
- All templates must be Meta-approved before use (message type: template).
- Interactive messages (buttons, lists) are valid for session replies only (within 24h window).
- NDPR consent gate: check `whatsapp_opted_in = true` on `whatsapp_contacts` before ANY send.
- Unsubscribe: inbound reply "STOP" → webhook handler → set `whatsapp_opted_in = false`.
- Rate limit: 1,000 business-initiated conversations/day on standard tier. Hard-stop the
  Inngest job if `daily_sent_count >= 1000`; log a warning to the notification centre.
- All dispatch runs through Inngest jobs, never directly in an API route (too slow for bulk).
- Log every send to `whatsapp_send_log`; per-campaign totals in `whatsapp_campaigns`.
- NEVER store phone numbers in plaintext in `whatsapp_send_log`; SHA-256 hash them. Store
  E.164 format (`+2348012345678`) only in `whatsapp_contacts` with RLS.
WhatsApp runs on Meta Cloud API (Model A) only. Do not add Africa's Talking or any other
third-party WhatsApp gateway. The old Africa's Talking NPS path was removed on 2026-07-11.

## AI Visibility Tracker (Phase 4 — built)
Checks brand presence in ChatGPT, Gemini, and Perplexity. Runs weekly (Monday 9am cron) +
on-demand. Tables: `ai_visibility_checks` (per-question), `ai_visibility_scores` (weekly
aggregate per brand). Claude (structural tier) generates 5 category questions AND analyses
each response for brand mentions/tone/competitors. External platform queries use raw fetch
(not our SDK), conditional on env vars: `OPENAI_API_KEY` → ChatGPT, `GOOGLE_AI_API_KEY` →
Gemini, `PERPLEXITY_API_KEY` → Perplexity. At least one must be set. Missing platforms are
skipped gracefully. Score 0–100 = weighted mention rate (position early=1.0/mid=0.7/late=0.4
× tone pos=1.1/neu=1.0/neg=0.9) × 100. On-demand trigger: POST `/api/ai-visibility/check`.

## GA4 OAuth (Phase 4 — built)
CSRF: `ga4_oauth_state` cookie (httpOnly, sameSite lax, 10-min TTL). Tokens stored encrypted
in `ga4_connections` (access_token, refresh_token, token_expiry). Auto-refresh: check
`token_expiry` before every sync, refresh if within 2 minutes of expiry. Property ID stored
as a numeric string (strip the `properties/` prefix). `metricAggregations: ['TOTAL']` is
required in the `runReport` body for `totals[]` to populate.

## Google Sign-In (Phase 4 — built)
Supabase `signInWithOAuth({ provider: 'google' })`, client-side only via `GoogleSignInButton`.
Auth callback at `/api/auth/callback`: after `exchangeCodeForSession`, check
`app_metadata.provider`. New OAuth users (no `workspace_members` row) → create workspace +
member (owner) + blank brand → redirect to `/onboarding`. Returning users → `/dashboard`
(or the `?next=` param).

## Sentiment data model
Social mentions come from ALL connected platforms (X and Instagram today; TikTok/LinkedIn/
Facebook are schema-supported). Each mention row carries a `platform` field.
`sentiment_daily` stores per-day aggregates in two layers:
- Top-level `social_score` = volume-weighted blend across platforms:
  Σ(platform_score × platform_volume) / total_volume.
- `platform_breakdown` JSONB = per-platform detail
  `{ "twitter": { volume, score, positive_pct, neutral_pct, negative_pct }, "instagram": {...} }`.
  Add a platform by pushing a new key here; no migration needed.
The BHI reads only `social_score`. The Sentiment dashboard reads `platform_breakdown` for
per-platform pills and a split panel.
Free-tier mention sources (no paid API): X via `GET /2/users/:id/mentions` with the connected
OAuth token (direct @handle mentions only; app-only bearer search is NOT used, 402). Instagram
via `ig_hashtags`/`recent_media` (hashtag search, 30/week free) and `/tags` (tagged media);
both require a connected Instagram Business account.

## Voice for any user-facing copy (hard rule)
Warm, confident, plain English. Active voice. Connection before sales. No jargon. No em dashes.
Banned words: delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless, tapestry.

## Definition of done
A change is done only when all of the following hold:
1. `npx tsc --noEmit` passes with no errors.
2. `npm run lint` introduces no new errors (pre-existing warnings are acceptable).
3. For any DB change, the migration is written, enables RLS with a workspace policy, and
   `supabase migration list` shows it as the only pending item before you push.
4. For any user-triggered route using the service client, ownership is verified per "Data access".
5. For a new dashboard module, the product tour (`data-tour` + tour definition + topbar trigger)
   is wired.
6. You drove the actual flow (or the closest reachable equivalent) and observed it work, rather
   than assuming. When a fix exposes a new symptom, re-test after each step; do not declare
   victory after the first fix in a chain.
7. User-facing copy obeys the Voice rule.

## Workflow
Build → type-check + lint → drive the flow → show me the diff → I confirm → commit. A session
commits as many features/fixes as land cleanly that day (recent sessions ship 5–10 commits);
the constraint is "each commit is one coherent, working change," not "one commit per session."
Commit straight to `main` is the established habit, but pushing/merging to `main` may be gated
by review tooling; when it is, open a PR and leave it for me unless I say otherwise.

## Project skills
- `bp-feature` — build a BrandPulse feature end to end the standard way.
- `bp-ai-prompt` — construct a prompt with the mandatory 3-layer + cultural block.
- `bp-supabase-rls` — apply the standard RLS policy to every new table.
- `bp-connector` — build a third-party connector (OAuth + encrypted tokens + Inngest sync).
- `bp-inngest-job` — add a background job (all async/bulk work runs on Inngest).
- `bp-security-audit` — run an IDOR / RLS / webhook / OAuth / secrets audit.

## Known-deferred and open questions
- Billing/Plans is deferred until post-beta and will use Paystack, not Stripe. Stripe code
  exists but is unconfigured; brand-limit enforcement is intentionally bypassed.
- Several connectors are code-complete but inert pending credentials (HubSpot, Google Ads,
  YouTube, TikTok, SerpAPI/Geo-Lift, the WhatsApp Cloud API env vars). Verify the specific env
  var before promising a feature works end to end.
- Board-grade AI runs on Sonnet 4.6 by decision (confirmed 2026-07-11), not Opus. The tier
  mapping in `src/lib/ai/client.ts` is correct; do not "upgrade" it without being asked.
