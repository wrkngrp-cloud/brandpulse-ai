# BrandPulse AI — Project Rules

## What this is
Brand-intelligence SaaS for Nigerian / West African marketing teams, now serving
7 verticals (see `brand_type` below) — not FMCG-only.
Read the PRD set in `../docs` (one level above this repo root — Document 1
Foundations, 2 Modules & Data, 3 Roadmap/Prompts/Risk, 4 Build Guide) before
building any feature. The schema is in Document 2; the per-phase build prompts
are in Document 3. The PRDs are not checked into this git repo. This repo's own
`docs/` folder holds supporting working docs only (`industry-fit-strategy.md`,
`funnel-signals-explained.md`, `to-100-percent-build-list.md`) — those are not
the PRD set.

## Stack (do not deviate without asking)
Next.js 16 App Router + TypeScript + Turbopack (default) · Supabase (Postgres+Auth+
Realtime+Storage) · Tailwind + shadcn/ui · Recharts (+ D3 for Sankey/connectors) ·
Zustand · RHF + Zod · Anthropic Claude · Inngest for ALL background jobs · Upstash
for cache/rate-limit.

## Hard rules
- Multi-tenancy is enforced by RLS via is_workspace_member(). Never filter tenancy in app code.
- All AI and external-API calls are server-side. NEVER expose ANTHROPIC_API_KEY,
  OPENAI_API_KEY, or SUPABASE_SERVICE_ROLE_KEY to the client.
- Write the SQL migration BEFORE the API route that uses it.
- Mark every component "use client" or leave it a server component, explicitly.
- AI calls go through lib/ai/client.ts (Anthropic-only). FOUR-TIER ROUTING:
  · cultural features (sentiment, Pre-Post widget, anything touching Pidgin/Yoruba/Igbo/Hausa) → claude-haiku-4-5-20251001
  · structural features (reports, competitive briefings, funnel diagnosis, general AI answers, chat) → claude-sonnet-4-6
  · board-grade business cases only → claude-opus-4-8
  NVIDIA NIM is NOT in use (account pending verification). Do not add NIM or any OpenAI-compatible calls.
  Cache the Layer-1 brand context. Never display the model name in any UI.
- Surveys deliver by email + in-app + WhatsApp + shareable link. NO SMS, NO USSD.
- OOH attribution = branded vanity link + UTM (primary), search-uplift (corroboration).
  Event attribution = ambassador-captured leads via the PWA. QR is a secondary toggle, off by default.
- Errors → sonner toasts. Loading → shadcn skeletons. Everything responsive from iPhone SE.
- Public endpoints (/survey/[id], /ambassador/[token], /go/[slug]) post/redirect via a
  service-role API route that validates the token/slug. NEVER open anon RLS on those tables.
- Brands carry a `brand_type` (fmcg | fintech | venue | b2b_saas | marketplace |
  beverage_alcohol | b2b_distribution). Any new funnel/BHI signal, nav item, or
  connector recommendation MUST branch on `brand_type` (see `src/lib/industry-config.ts`,
  `src/lib/bhi.ts` `BRAND_TYPE_WEIGHTS`) instead of assuming FMCG. Check
  `docs/industry-fit-strategy.md` before adding a signal that only makes sense for
  one vertical.
- Every dashboard module ships with a first-visit product tour (`data-tour` attributes
  + an entry in `src/components/tours/tour-definitions.ts`) and is reachable from the
  persistent topbar "Show me around" trigger. Add both when building a new module.

## Active brand lookup (critical — always use this)
ALWAYS use `getActiveBrandId(supabase)` or `getActiveBrand<T>(supabase, 'col1, col2')`
from `src/lib/active-brand.ts` in every API route that needs the current brand.
NEVER use `.from('brands').select(...).limit(1).single()` — this ignores the
active_brand_id cookie and breaks multi-brand workspaces silently.

## WhatsApp Deep Integration — Model A (Phase 4)
Architecture: BrandPulse-owned WABA. All sends originate from BrandPulse's own
WhatsApp Business number. Users manage contacts and templates inside BrandPulse UI
only — they never touch an API key or external platform.
API: Meta Cloud API v20.0
Send endpoint: POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages
Webhook: POST /api/whatsapp/webhook (delivery status callbacks: sent/delivered/read/failed)
Env vars (server-side only, never client):
  WHATSAPP_PHONE_NUMBER_ID    — the registered phone number's ID
  WHATSAPP_BUSINESS_ACCOUNT_ID — the WABA ID
  WHATSAPP_ACCESS_TOKEN       — permanent system user token (never page token)
Rules:
- All templates must be pre-approved by Meta before use (message type: template).
- Interactive messages (buttons, lists) are valid for session replies only (within 24h window).
- NDPR consent gate: check whatsapp_opted_in = true on whatsapp_contacts before ANY send.
  Never send to a contact without explicit opt-in on file.
- Unsubscribe: inbound reply "STOP" → webhook handler → set whatsapp_opted_in = false.
- Rate limit: 1,000 business-initiated conversations/day on standard tier. Hard-stop Inngest
  job if daily_sent_count >= 1000; log warning to notification centre.
- All dispatch runs through Inngest jobs (never direct in API routes — too slow for bulk).
- Log every send to whatsapp_send_log; per-campaign totals in whatsapp_campaigns.
- NEVER store phone numbers in plain text. Hash with SHA-256 for whatsapp_send_log.
  Store E.164 format (+2348012345678) only in whatsapp_contacts with RLS.

## AI Visibility Tracker (Phase 4 — built)
Checks brand presence in ChatGPT, Gemini, and Perplexity. Runs weekly (Monday 9am cron) + on-demand.
Tables: `ai_visibility_checks` (per-question results), `ai_visibility_scores` (weekly aggregate per brand).
Claude (structural tier) generates 5 category questions AND analyzes each response for brand mentions/tone/competitors.
External platform queries use raw fetch (not SDK) — conditional on env vars:
  OPENAI_API_KEY        → ChatGPT GPT-4o mini
  GOOGLE_AI_API_KEY     → Gemini 2.0 Flash
  PERPLEXITY_API_KEY    → Perplexity Sonar
At least one must be set for checks to run. Missing platforms are skipped gracefully.
Score: 0–100. Formula: weighted mention rate (position: early=1.0/mid=0.7/late=0.4 × tone: pos=1.1/neu=1.0/neg=0.9) × 100.
Trigger on-demand: POST /api/ai-visibility/check (fires ai-visibility/check Inngest event).

## GA4 OAuth (Phase 4 — built)
CSRF: ga4_oauth_state cookie (httpOnly, sameSite: lax, 10min TTL).
Tokens: stored encrypted in ga4_connections (access_token, refresh_token, token_expiry).
Auto-refresh: check token_expiry before every sync; refresh if within 2 minutes of expiry.
Property ID: stored as numeric string — strip 'properties/' prefix from Admin API resource name.
metricAggregations: ['TOTAL'] is required in runReport body for totals[] to populate.

## Google Sign-In (Phase 4 — built)
Supabase signInWithOAuth({ provider: 'google' }) — client-side only via GoogleSignInButton.
Auth callback at /api/auth/callback: after exchangeCodeForSession, checks app_metadata.provider.
New OAuth users (no workspace_members row) → create workspace + member (owner) + blank brand
→ redirect to /onboarding. Returning users → redirect to /dashboard (or ?next= param).

## Sentiment data model
Social mentions are collected from ALL connected platforms (X and Instagram today;
TikTok/LinkedIn/Facebook are supported by the schema). Each mention row carries
a `platform` field ('twitter' | 'instagram' | ...).

`sentiment_daily` stores per-day aggregates with two layers:
- Top-level `social_score` = volume-weighted blend across all platforms.
  Formula: Σ(platform_score × platform_volume) / total_volume
- `platform_breakdown` JSONB = per-platform detail:
  { "twitter": { volume, score, positive_pct, neutral_pct, negative_pct },
    "instagram": { ... } }
  Add new platforms by pushing a new key here — no migration needed.

The BHI reads only `social_score` (the blended value). The Sentiment dashboard
reads `platform_breakdown` to show per-platform pills and a split panel.

Social mention sources (free tier, no paid API needed):
- X: GET /2/users/:id/mentions with the connected OAuth token (free tier, user context)
  Catches direct @handle mentions only. app-only bearer token search is NOT used (402).
- Instagram: GET /{ig-user-id}/ig_hashtags + /recent_media (hashtag search, 30/week free)
  and GET /{ig-user-id}/tags (tagged media, free). Hashtags derived from brand name.
  Both require a connected Instagram Business account.

## Voice for any user-facing copy
Warm, confident, plain English. Active voice. Connection before sales. No jargon. No em dashes.
Banned words: delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless, tapestry.

## Workflow
Build → test locally → show me the diff → I confirm → commit. A session commits
as many features/fixes as land cleanly that day (recent sessions have shipped
5–10 commits) — the constraint is "each commit is one coherent, working change,"
not "one commit per session."
