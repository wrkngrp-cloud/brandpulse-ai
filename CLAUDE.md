# BrandGauge — Project Rules

This file is the contract for working in this repo. It is meant to be self-sufficient:
if you follow it, you should not need to guess how things are done here. When it and the
code disagree, the code wins and this file is wrong. Fix the file.

## What this is
Brand-intelligence SaaS for Nigerian / West African marketing teams, serving 8 verticals
(see `brand_type` below), not FMCG-only. It helps marketers measure brand health and
justify spend to management.

Read the PRD set in `docs/prd/` before building any feature. It is BrandGauge v8, five
documents, and it is checked into git as of 14 September 2026:

- `01-foundations.md`: identity, vision, verticals, personas, the Unified Funnel, module map
- `02-modules-and-data.md`: module specs with build status, the tool suite, the data model,
  and the data-access rules
- `03-roadmap-prompts-metrics-risk.md`: where the build is, what is next, the runtime AI
  prompts in full, every metric formula, the risk register
- `04-build-guide.md`: stack and versions, environment variables and what each one gates,
  conventions, definition of done
- `05-design-system-and-decisions.md`: the design system in summary, and the **locked
  decisions register**

**Read the locked decisions register in Document 5 at the start of any session** before
changing anything settled. The check is explicit, never assumed.

Every item in Documents 2 and 3 carries a status: Built, Inert (built but missing a named
credential), Deferred, or Dropped. Check the status before promising a feature works.

The earlier BrandPulse AI v6 set lived one level above this repo root and was not in git,
which meant no cloud session could ever see it. That is why the set moved in here. v6 is
superseded; if you find a copy, it is history, not the spec.

This repo's `docs/` folder also holds supporting working docs that are **not** the PRD set:
`industry-fit-strategy.md`, `funnel-signals-explained.md`, `to-100-percent-build-list.md`,
`scoreboard-and-leads.md`, `brand-icons.md`, `motion-amendments.md`,
`design-system-update-brief.md`, `connector-setup-guide.md`,
`free-tools-acquisition-plan.md`, `internal-tool-plan.md`.

## Commands
- `npm run dev` — local dev server (Next.js + Turbopack).
- `npm run build` — production build. Must pass before a change is done.
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`).
- `npx tsc --noEmit` — type-check the whole project. Must pass before a change is done.
- `supabase db push` — apply pending SQL migrations to the linked project. Run
  `supabase migration list` first to confirm only your migration is pending. This is the
  path on your own machine.
- `npm run db:pending` / `npm run db:apply` — the same thing over HTTPS, for a Claude Code
  cloud session. `db push` opens a raw Postgres connection to the pooler on 5432/6543, and a
  cloud session has no raw TCP egress, so it cannot work there however the network policy is
  set. `scripts/apply-migrations.mjs` runs each pending migration through the Supabase
  Management API instead, and writes the same `supabase_migrations.schema_migrations` ledger
  the CLI reads, so the two never disagree. It needs `SUPABASE_ACCESS_TOKEN` in the
  environment, plus `supabase.com` and `*.supabase.co` on the environment's allowed domains.
  `db:pending` only plans; nothing changes without `--apply`. Each migration commits with its
  ledger row or neither lands, and a failure stops the run rather than half-applying a set.
  `node scripts/apply-migrations.mjs --self-test` checks the parsing and diff offline.
- `npm run seeds:check` — check every demo-seed insert against the migration set
  with no database. Postgres rejects the whole insert on one bad column and the
  seeds discard the error, so a broken seed still answers success.
- `npm run demo:check` — run the shared demo generators against a fake client and
  check every row they actually produce. Covers what the static check cannot.
- `npm run icons` / `npm run icons:check` — build the sprite from
  `brand/icons/currentcolor`, and fail when a glyph the product asks for was
  never drawn.
- `npm run favicon` / `npm run favicon:check` — cut the browser tab icon from
  `brand/logo/brandgauge-mark-mono-ink.svg`, and fail when the generated files
  have drifted from the mark. The mark is never redrawn for this, only reframed
  square and recoloured onto a Paper plane; the duotone is not used because the
  design system forbids it below 24px.
- `npm run tools:check` — exercise the Free Tools libraries offline. Compiles them
  standalone with the AI, press and database calls stubbed, so no key and no network are
  needed, and covers the SSRF screening in `fetch-public.ts`, the HTML reader, every
  engine's evidence guards, and the navigation and RLS wiring the type checker cannot see.
- `npm run desk:check` — check the Desk's access logic with no database: the
  permission keys seeded in SQL against the ones the code checks, attachment
  signatures against forgery and cross-thread replay, module-path resolution, and
  email masking. A typo in a role template grants nothing and raises nothing, which
  is why it is checked rather than trusted.
- `npm run desk:sql` — apply every migration to a throwaway local Postgres and
  exercise the half of the Desk that lives in SQL: `staff_can` precedence, RLS on
  the staff, telemetry and chat tables, the security-definer grants, and the
  support triggers. Needs a local postgres and nothing else, no Supabase project
  and no credentials. 82 assertions. It fails the run when any of them regresses,
  which is checked by breaking a policy on purpose rather than assumed.
- `npm run metrics:check` — exercise `src/lib/social/post-metrics.ts` against
  mocked platform responses. Real calls cost X credit and burn Instagram's
  hashtag quota, so every branch is covered offline instead.
  `./scripts/check-post-metrics.sh` hits the live APIs: with no arguments it
  probes the credentials, and given post URLs or ids it reads them in one
  batched call and prints a paste-ready POST body. Both modes spend X credit.
There is no unit-test suite. Verify behaviour by type-check + lint + driving the actual
flow (see Definition of done).

Demo data goes live by RUNNING the seeds, not by deploying them. The seed
routes are endpoints; the demo accounts keep whatever was written the last time
they ran. After any change to seed code:
`ADMIN_SECRET=... ./scripts/seed-demos.sh https://<deployment>` — it POSTs all
four accounts, wipes and rebuilds each, and prints any failed writes per table.

Demo seeds: brand health history is produced by `bhiSnapshotRows` in
`src/lib/demo/bhi-series.ts`, which runs the real `computeFullBHI` with the
brand's `brand_type`, so seeded history matches the live number and is stamped
with the current `BHI_FORMULA_VERSION`. Never hand-roll a BHI in a seed.

Influencer post metrics: public counts (likes, comments, plays) are pulled from
a post URL by `fetchPostMetrics`. Reach, impressions and saves are owner-only on
every platform, so they are never pulled and never guessed. Every number carries
its origin in `influencer_posts.metric_sources` (`pulled` | `entered` |
`estimated`) and the UI must show it, so a screen never implies a typed figure
was measured. TikTok has no public lookup at all; it needs the creator to
connect their own account.

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
Realtime + Storage) · Tailwind + shadcn/ui on the BrandGauge token layer · Recharts
(+ D3 for Sankey/connectors) ·
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
- Errors surface as sonner toasts. Loading uses a skeleton shaped like the thing that is
  coming, never a spinner. Everything is responsive from iPhone SE width up.
- Public endpoints (`/survey/[id]`, `/ambassador/[token]`, `/go/[slug]`) post/redirect via a
  service-role API route that validates the token/slug. NEVER open anon RLS on those tables.
  The support chat (`/api/support/*`) is the same pattern: a stranger carries a random
  `bg_visitor` httpOnly cookie, every route resolves the conversation from the session or
  that cookie and never from the request body, and `support-attachments` is a private
  bucket read through short-lived signed URLs.
- The public scoreboard (`/scoreboard`, `/api/scoreboard/*`) is the one open endpoint with no
  token, because it reads a public news feed and touches no tenant row: there is no caller to
  verify. It is guarded instead by an IP rate limit and a cache, both of which fail open. Its
  tables (`public_scans`, `leads`) are the one place RLS does not scope to a workspace: a lead
  belongs to BrandGauge, so they scope to `staff_can('leads.view')` and are written by the
  service role only. See `docs/scoreboard-and-leads.md`. The free-tool tables (`tool_runs`,
  `tool_events`, `tool_campaigns`, `tool_placements`, `tool_visits`) follow the same pattern
  for the same reason, with one addition: once a run or campaign is claimed they are also
  readable by the workspace that claimed it. `tool_responses` holds personal data and scopes
  to that workspace only, never to the lead desk.
- Every AI call goes through `callAi`, which logs tokens, cost and latency to `ai_calls`
  and a counter to `usage_events`. Pass `meta` (`workspaceId`, `brandId`, `userId`,
  `feature`) at every call site so the call is attributed; without it the row lands under
  `feature: 'unattributed'`, which is visible and fixable rather than silently wrong.
  Dashboard module usage is recorded by `ModuleBeacon` in the dashboard shell through
  `record_feature_event`. Add a new module to `src/lib/modules.ts` or it has no
  adoption history.
- Brands carry a `brand_type` (fmcg | fintech | venue | b2b_saas | marketplace |
  beverage_alcohol | b2b_distribution | agency). Any new funnel/BHI signal, nav item, or connector
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

## Free Tools and product-led acquisition
Five public tools run for a visitor who has signed up for nothing and connected nothing:
the PR Scoreboard at `/scoreboard` (predates the rest, keeps its route and its own markup),
plus `/tools/brand-gap`, `/tools/competitor-tracker`, `/tools/market-demand` and
`/tools/campaign-audit`. The directory is `/tools`. `/tools/offline-tracker` is built and
retired: unlisted since 18 October 2026, still reachable, still resolving its printed slugs.
See `docs/free-tools-acquisition-plan.md`.

- `src/lib/tools/registry.ts` is the single source for the nav dropdown, the directory and
  the end-of-report suggestion. Another tool is one entry plus a page. The nav label is
  exactly **Free Tools**. `listed: false` retires a tool from the lineup without deleting it:
  the page, the API and the data stay, and `toolById` still resolves it so the lead desk has
  a name for it.
- The result is gated on an email, on the server, in `src/lib/tools/gate.ts`. The gate comes
  **after** the work and after one complete finding with its source; the withheld findings
  are trimmed out of the payload, so nothing in dev tools contradicts what the page says.
  Three fields only: email, name, role. The company is derived from the website the tool
  already has. `src/lib/tools/leads.ts` reads before it writes, never overwrites first-touch
  `source`, and never blanks a field an earlier run filled.
- The Brand Perception Gap reads a brand's stated identity off its own pages against how the
  press and an AI assistant describe it. Our own generation still goes through `callAi`; the
  external assistants in `src/lib/ai/assistants.ts` are the thing being measured, shared with
  the AI Visibility job, and never named in any UI. An assistant answer has no `sourceUrl`,
  so `Evidence.sourceUrl` is optional and the card renders that source named but unlinked.
  Its claim importer fills only the brand fields that are empty, and never overwrites a
  category, a set of values or a tone the marketer configured.
- A visitor-supplied URL is fetched ONLY through `fetchPublic` in
  `src/lib/tools/fetch-public.ts`. It screens DNS against the private ranges before the
  socket opens and follows redirects by hand so every hop is screened. Do not add a plain
  `fetch` of a public URL to an open endpoint.
- Anonymous analyses live in `tool_runs`. The visitor gets 32 random bytes; the table stores
  only the SHA-256. Never write personal data into a run: the report URL is shareable
  precisely because there is none.
- Claiming (`/tools/claim`, `src/lib/tools/import.ts`) must leave the destination module
  populated. Never send someone to an empty dashboard, and never make them retype something
  a tool already knows. `next` survives the whole auth round trip and is checked by
  `safeNext` in `src/lib/safe-next.ts`.
- Every finding carries a provenance: `observed`, `estimated`, `interpreted` or
  `recommended` (`src/lib/tools/report.ts`), and the UI renders each differently. An AI
  reading must never be presented as a measurement. A finding with no evidence is dropped,
  not softened.
- Never invent a search volume, growth rate, keyword difficulty, CPC, traffic estimate,
  market share, reach figure or revenue impact in these tools. Where a licensed provider is
  missing (`SERPAPI_KEY`), the demand finder reports a content gap and says no search data
  was measured. Where a check did not run (`PAGESPEED_API_KEY` / PSI quota), the audit says
  so instead of substituting an opinion.
- The audit has no overall score, by decision: there is no conversion data to calibrate one.
- Offline-tracker slugs are printed on billboards and can never be reissued. `mintSlug`
  checks `print_placements`, `ooh_sites` and `tool_placements`, and `/go/[slug]` resolves all
  three in that order. Claiming a campaign moves the row (sets `workspace_id`/`brand_id`)
  rather than copying it.
- Campaign enquiries (`tool_responses`) are refused without consent, store the exact wording
  the person agreed to, and are the one table here the lead desk cannot read.
- Acquisition events go to `tool_events` (first-party; `posthog-js` is a dependency and is
  imported nowhere). The funnel is `/desk/leads/funnel`, on `leads.view` like the rest of
  the lead desk.
- Beta is free. Do not add a trial, an expiry, a paywall or an upgrade prompt to any of this.

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
Architecture: BrandGauge-owned WABA. All sends originate from BrandGauge's own WhatsApp
Business number. Users manage contacts and templates inside BrandGauge UI only; they never
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

## The brand system (BrandGauge v3.4) — read before writing any UI
The system lives in `brand/` at the repo root and `brand/DESIGN-SYSTEM.md` is the contract.
Every colour, type, space and motion value comes from `brand/tokens.css`; the shadcn token
layer in `src/app/globals.css` only aliases it. Do not invent a value, and do not reach for
a hex, an `rgb()`, an `oklch()` or a Tailwind palette class — there are none left in `src`.

- **Colour.** Ground (paper, shell, card, ink) carries about 75% of a surface. Flare is the
  hero, applied to whole planes, once per frame; it fills, it never outlines, and it is
  never text — `--tx-flare` (Char) is Flare as type. Type on a hot plane is `--on-hot`
  (ink), because paper on Flare reads 3.3:1 and ink reads 5.3:1. There is no blue and no
  blue. Polarity runs `--pos` (forest green, hue 110 — `#345C2C` on Paper,
  `#9BC98A` on Ink), `--neu` (ash), `--neg` (flare). The green is dark and Flare is
  bright, so the pair stays separable in lightness alone; success is still a filled
  tick plus the word, never a hue on its own. Never introduce a second green. Ash is not a text colour; use `--tx-2` or `--tx-3`, which
  both clear 7:1 on every ground.
- **Type.** Nohemi for everything, Disket Mono (`--font-num`, or the `.bg-num` class) for
  numerals only, always tabular. Nothing else is monospace — not eyebrows, nav, captions or
  chips. Capitals belong to `.bg-label` alone. Deltas read `+` and `−`; Disket has no
  triangles and the licence forbids adding them.
- **Surfaces.** Elevation is a one-pixel hairline at `--line`, never a shadow. The only
  shadow is the focus ring: 2px `--flare` at 2px offset. Radius is cards 4px, controls 3px,
  ticks 2.5px, status pills round. Nothing else is rounded.
- **Icons.** The 107 supplied glyphs in `brand/icons/`, via `src/components/brand/icon.tsx`.
  No icon library — do not add one. A missing glyph gets drawn on the construction grid in
  section 7 of the design system. See `docs/brand-icons.md`.
- **Components.** Use the primitives: `Gauge` (the BHI), `Crescendo` (every progress or
  score bar), `Meter` (every metric row), `Readout`, `Delta`, `StatusPill`, `MentionCard`,
  `ReadingStrip`, `AskBar`, `Label`, `Icon`, `Pattern`. Mention text stays verbatim,
  unglossed and unitalicised in every language.
- **Charts.** Only the subject series carries heat (`--chart-1`); comparisons are the
  neutral ink steps `--chart-2` to `--chart-5`, dashed for lines. Threshold and benchmark
  lines are hairlines, not ramp colours. Every chart goes through `ChartState`, so it ships
  a chart-shaped skeleton and an empty state that names the next action.
- **Motion.** The needle settles and nothing bounces. `.bg-press` on everything pressable,
  the needle transition on a value change, and the gauge's first-paint sequence once per
  session. Banned outright: `window.addEventListener('scroll')`, parallax, marquees,
  spinners and anything that loops, numbers counting up, hover lift, per-element
  fade-and-slide-up, and animating top, left, width or height.
- **Logo.** Use the SVGs in `brand/logo/` through `src/components/brand/logo.tsx`. Never
  redraw the mark, simplify it, or rebuild the needle from ratios. The browser tab icon is
  generated from the mark by `npm run favicon`, never hand-drawn: it reframes the supplied
  paths square on a Paper plane and takes the mono variant, because the duotone is banned
  below 24px. `src/app/icon.svg`, `apple-icon.png` and `favicon.ico` are build output, so
  edit the mark or the script rather than the files.
- Ship a screen only when it passes the audit in section 12 of the design system.

## The Desk (our internal tool)
`desk.brandgauge.app`, served from this app at the `/desk` path. `docs/internal-tool-plan.md`
is the spec. Rules that are easy to break without noticing:

- **Host routing.** `src/proxy.ts` rewrites `DESK_HOST` onto `/desk`. With `DESK_HOST` set,
  `/desk` on the main host 404s; with it unset, `/desk` answers there so the Desk can be
  previewed on a deployment URL. The Desk host serves nothing but the Desk.
- **The Desk has no API routes.** Every mutation is a server action. Do not add
  `src/app/desk/api/**`.
- **One gate.** `requireStaff(permission?, audit?)` from `src/lib/desk/auth.ts` at the top of
  every Desk page and action. It is the only way to get a staff record, so a screen that
  skips it renders nothing. Reads are audited as well as writes.
- **One data layer.** The modules under `src/lib/desk/` (`data.ts`, `accounts.ts`,
  `adoption.ts`) are the only place allowed to use the service client for cross-tenant
  reads, and they apply dataset redaction (`data.customer_email`, `data.ai_cost`,
  `data.revenue_figures`, `data.customer_content`, `data.audit_all`) before returning rows.
  Never redact in a component, and never reach for the service client from a Desk page or
  action.
- **Email.** Every email in the product goes out through `sendMail` in
  `src/lib/email/send.ts`, and callers act on what it returns. Never call
  `resend.emails.send()` directly: the SDK resolves with `{ data: null, error }` when the
  API refuses a message, so a try/catch around it catches nothing and the code reports a
  send that never happened. That bug shipped at eleven call sites and is why staff
  invitations said "sent" while Resend was rejecting the sending domain. A Desk screen
  shows the reason; a background job logs it and does not count the send.
- **Permissions.** `staff_can(key)` in SQL, `session.can(key)` in app code, both resolving
  deny override → grant override → role template, with `super_admin` holding everything.
  Add a key to `src/lib/desk/permissions.ts` AND to the `super_admin` seed, then run
  `npm run desk:check` and `npm run desk:sql`.
- **Access is invite-only.** No signup route on the Desk host, no OAuth button. A correct
  password is not access: the login action signs the session out again if there is no
  active `staff` row. Nobody can act on their own staff row, and the last active
  super admin cannot be suspended, removed or moved off the role. The first super admin is
  seeded by migration, never by a route.
- **Impersonation is read-only, and the middleware is why.** An approved session adds the
  staff member to `workspace_members` on the `viewer` role, so the product's own RLS does
  the scoping and no read path was rewritten. Nothing in this schema makes `viewer`
  read-only, so `src/proxy.ts` refuses any non-GET request and every `/api/` path while
  `active_impersonation()` returns a workspace. That rests on one assumption: nothing in
  this app mutates on a GET. If you ever add a GET that writes, it has to be excluded there
  or it becomes a hole. A session needs a customer approval row, expires on the clock
  whether or not the sweep runs, and `end_impersonation()` is what takes the membership
  away.
- **There is one lead desk, and it is `/desk/leads`.** `lead_desk_admins` and
  `is_lead_desk()` were dropped on 18 October: nothing had ever inserted a row into that
  table, so the function returned false for every caller and both `/dashboard/leads` and
  its funnel bounced everyone to `/dashboard` from the day they shipped. Lead access is
  `leads.view` to read and `leads.edit` to work the pipeline, which `bizdev` holds. Do not
  reintroduce a second allowlist.

## Voice for any user-facing copy (hard rule)
Warm, confident, plain English. Active voice. Connection before sales. No jargon. No em dashes.
Banned words: delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless, tapestry.

## Definition of done
A change is done only when all of the following hold:
1. `npx tsc --noEmit` passes with no errors.
2. `npm run lint` introduces no new errors (pre-existing warnings are acceptable).
3. For any DB change, the migration is written, enables RLS with a workspace policy, and
   `supabase migration list` shows it as the only pending item before you push.
   For a change to Desk permissions, the support chat or the module registry,
   `npm run desk:check` and `npm run desk:sql` pass.
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
- `bp-feature` — build a BrandGauge feature end to end the standard way.
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
- The free tools degrade rather than break on a missing credential: `SERPAPI_KEY` gates
  search evidence in the Market Demand Gap Finder, and `PAGESPEED_API_KEY` only raises the
  PageSpeed quota (the API answers keyless at a low rate). Both are stated in the report when
  absent; neither blocks the tool.
- Board-grade AI runs on Sonnet 4.6 by decision (confirmed 2026-07-11), not Opus. The tier
  mapping in `src/lib/ai/client.ts` is correct; do not "upgrade" it without being asked.
