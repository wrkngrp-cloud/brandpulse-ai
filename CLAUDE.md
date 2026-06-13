# BrandPulse AI — Project Rules

## What this is
Brand-intelligence SaaS for Nigerian / West African marketing teams.
Read the PRD set in /docs (Document 1 Foundations, 2 Modules & Data, 3 Roadmap/
Prompts/Risk, 4 Build Guide) before building any feature. The schema is in
Document 2; the per-phase build prompts are in Document 3.

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
One feature per session. Build → test locally → show me the diff → I confirm → commit.
