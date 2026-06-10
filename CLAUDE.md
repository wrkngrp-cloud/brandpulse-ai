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
- AI calls go through lib/ai/ (a provider-agnostic wrapper). THREE-TIER ROUTING:
  · structural features (reports, competitive briefings, funnel diagnosis, general AI answers) → NVIDIA NIM Llama 4 Maverick (meta/llama-4-maverick-17b-128e-instruct), free tier
  · cultural features (sentiment, Pre-Post widget, anything touching Pidgin/Yoruba/Igbo/Hausa) → Claude Haiku 4.5 (no other model is trained for this)
  · board-grade business cases only → Claude Opus 4.8
  Cache the Layer-1 brand context for Claude calls. Credit-free fallback if NIM credits run low: zhipu/glm-4.
- Surveys deliver by email + in-app + WhatsApp + shareable link. NO SMS, NO USSD.
- OOH attribution = branded vanity link + UTM (primary), search-uplift (corroboration).
  Event attribution = ambassador-captured leads via the PWA. QR is a secondary toggle, off by default.
- Errors → sonner toasts. Loading → shadcn skeletons. Everything responsive from iPhone SE.
- Public endpoints (/survey/[id], /ambassador/[token], /go/[slug]) post/redirect via a
  service-role API route that validates the token/slug. NEVER open anon RLS on those tables.

## Voice for any user-facing copy
Warm, confident, plain English. Active voice. Connection before sales. No jargon. No em dashes.
Banned words: delve, underscore, pivotal, crucial, robust, vibrant, leverage, seamless, tapestry.

## Workflow
One feature per session. Build → test locally → show me the diff → I confirm → commit.
