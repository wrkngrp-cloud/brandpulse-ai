# BrandPulse AI — Build Status

> Feed this file into your project chat at the start of each session to bring it up to date.
> Updated after every pushed session. Last updated: 2026-06-20.

---

## What is live (production, Vercel)

### Phase 0 — Validation ✅
- Cultural sentiment gate passed at 85.4% accuracy
- 7 miss-pattern fixes applied to the B.2 prompt (cultural interpretation table expanded)

### Phase 1 — MVP Input Spine ✅
| Feature | Route / Component | Notes |
|---|---|---|
| Auth (login, signup, forgot/reset) | `/auth/*` | Supabase Auth + middleware |
| AI-assisted onboarding | `/onboarding` | Brand inference via `POST /api/ai/brand-infer` (Sonnet 4.6) |
| Social connections (X + Instagram OAuth) | `/settings/connections`, `/api/social/connect/[platform]`, `/api/social/callback/[platform]` | OAuth flow complete; finish-connect for Instagram |
| Sentiment analysis dashboard | `/dashboard/sentiment` | Platform breakdown pills, blended `social_score`, crawl trigger |
| Social crawl (Inngest background job) | `src/lib/inngest/functions/` | X mentions + Instagram hashtags + tags |
| Share of Voice | `/dashboard/sentiment` | SOV vs manual competitor list |
| Brand Health Index | `/dashboard` | Redesigned semicircle gauge, zone badge, 3-tile grid, 30-day sparkline |
| AI Command Layer — floating widget | All dashboard pages | Persistent floating button, POST `/api/ai/ask` |
| AI Command Layer — full page + history | `/dashboard/ask` | Conversation sidebar, loads full message history from `/api/ai/conversations/[id]` |
| Pre-Post Intelligence Widget | `/dashboard/content` | 5 scores, risk flags, verdict, suggested rewrite |
| Content module | `/dashboard/content` | Funnel chart, content table |
| Pre-Post analysis | `/dashboard/pre-post` | Pre-campaign vs post-campaign comparison |
| Surveys — create + public page | `/dashboard/surveys`, `/survey/[id]` | New Survey dialog, shareable link copy, response collection, NPS, AI analysis |
| Settings — brand, profile, OOH domain, connections | `/dashboard/settings/*` | All settings pages live |

### Phase 2 (in progress) — Partial ✅
| Feature | Route / Component | Status |
|---|---|---|
| OOH Intelligence — site CRUD | `/dashboard/ooh`, `/dashboard/ooh/new`, `/dashboard/ooh/[id]`, `/dashboard/ooh/[id]/edit` | ✅ Complete |
| OOH map (react-map-gl) | `src/components/ooh/ooh-map-client.tsx` | ✅ ROI-colour-coded pins, fly-to, popup |
| OOH per-site map | `src/components/ooh/ooh-site-map-client.tsx` | ✅ Mapbox streets, GeolocateControl |
| Vanity links | `/go/[slug]`, `/s/[code]` | ✅ 302 redirect + visit logging |
| Search uplift (OOH) | `/api/ooh/search-uplift` | ✅ pytrends via Inngest, Pearson correlation, dual-axis chart |
| Campaign Intelligence Hub | `/dashboard/campaigns`, `/dashboard/campaigns/new`, `/dashboard/campaigns/[id]` | ✅ Complete — list, 2-step wizard, 4-tab detail |
| OOH–Campaign linking | Campaign detail → OOH Placements tab | ✅ Add/remove sites, campaign map |
| Events–Campaign linking | Campaign detail → Events tab; event detail → "Part of" link | ✅ |
| Events — setup wizard | `/dashboard/events/new` | ✅ 5-step wizard, ambassador creation |
| Ambassador PWA | `/ambassador/[token]` | ✅ Offline-first, 8 buttons, New Lead sheet, leaderboard |
| Live event dashboard | `/dashboard/events/[id]` | ✅ Supabase Realtime, go-live / close buttons |
| Post-event debrief | `/dashboard/events/[id]/debrief` | ✅ Success screen, localStorage draft auto-save |
| Event ROI report | `/dashboard/events/[id]` | ✅ Inngest generates within 24h; report-poller + viewer on detail page |
| Competitive Intelligence | `/dashboard/competitive` | ✅ AI briefing, SOV summary (no model name shown) |
| Vanity links public page | `/go/[slug]` | ✅ |
| Public survey page | `/survey/[id]` | ✅ No-auth, service-role validation |
| Survey AI analysis | `/dashboard/surveys/[id]` | ✅ NPS, awareness breakdown, Claude verbatim clusters |

### Not yet built (Phase 2 remaining)
| Feature | Priority | Notes |
|---|---|---|
| Survey distribution (email + WhatsApp send) | High | Surveys exist; no dispatch UI. Need "Send survey" sheet with email list + WhatsApp share link + Inngest job |
| Competitor management settings | High | API exists (`/api/brand/competitors`); no settings UI to add/edit/remove tracked competitors |
| Campaign performance view | High | Campaign detail shows linked assets; no aggregated metrics (total spend vs reach, OOH visits rollup, cost-per-lead) |
| ~~E6 — Visual brand mention detector~~ | ~~Medium~~ | ✅ Done — Claude Haiku Vision; "Scan now" on event detail page |
| ~~Unified Brand Funnel page~~ | ~~Medium~~ | ✅ Done — `/dashboard/funnel` |
| ~~Survey templates (all 6)~~ | ~~High~~ | ✅ Done — template picker + `survey-templates.ts` |
| ~~NPS & Advocacy Tracker~~ | ~~High~~ | ✅ Done — `/dashboard/surveys/nps` |
| Audio transcription module | Low | Whisper + Haiku pipeline |
| Full survey system (all 6 templates, WhatsApp delivery) | Low | Current survey is single-template; need 6 templates + email/WhatsApp dispatch |
| ~~Full sentiment engine~~ | ~~Low~~ | ✅ Done — 12-week view, alerts, emotion wheel, topic clusters |
| ~~Brand Equity Tracker~~ | ~~Low~~ | ✅ Done — `/dashboard/brand-equity` |

### Phase 3 — Items 1-5 ✅ (this session)

| Feature | Route / Key Files | Status |
|---|---|---|
| Cultural Intelligence Engine | `/dashboard/cultural`, `api/cultural/activation-ideas` | ✅ Done — CRS gauge, drift badge, emotion resonance bar, cultural calendar, activation ideas |
| Influencer Intelligence | `/dashboard/influencers`, `api/influencers`, `api/influencers/[id]/score` | ✅ Done — add/score/track creators; Cultural IQ + risk scoring via Claude |
| Creative Analysis | `/dashboard/creative`, `api/creative/{compare,identity,competitor}` | ✅ Done — A/B comparator, identity consistency check, competitor creative watch |
| Competitive Intelligence deep build | `/dashboard/competitive` (rebuilt), `api/competitive/sightings`, `lib/inngest/functions/competitive-weekly-briefing.ts` | ✅ Done — 4-tab layout: Briefing, ESOV League, Sightings feed, Scorecard; Monday 8am Lagos cron + Resend email |
| AI Command Layer v2 | `/dashboard/ask` (V2Tools section), `api/ai/{business-case,monthly-report,funnel-diagnostic}` | ✅ Done — Business Case (opus-4-8, board-ready), Monthly Report (sonnet, emails via Resend), Funnel Diagnostic (deep root-cause) |

**Phase 3 migrations:**
- `supabase/migrations/20260623000000_phase3_tables.sql` — influencers, competitor_sightings (`lat`/`lng`), weekly_briefings, creative_analyses (all with RLS)
- `supabase/migrations/20260622000000_visual_mentions.sql` — visual_mentions (E6, from prior session)

### Phase 3 — Items 2–5 ✅ (session 2026-06-19, commit 74f6bc6)

| Feature | Route / Key Files | Status |
|---|---|---|
| Email Connectors | `/api/connectors/mailchimp`, `/api/connectors/brevo`, `email-connect-card.tsx`, `email-connector-sync.ts` (Inngest) | ✅ Done — AES-256 encrypted keys, daily cron sync, `email_campaign_snapshots` table, settings UI |
| Radio AI Analysis | `/api/radio/analyse`, `radio-ai-analysis.tsx` | ✅ Done — Sonnet 4.6 daypart efficiency ranking, delivery alerts, budget reallocation |
| TV AI Analysis | `/api/tv/analyse`, `tv-ai-analysis.tsx` | ✅ Done — GRP/CPRP, prime time vs fringe, programme ranking |
| Print AI Analysis | `/api/print/analyse`, `print-ai-analysis.tsx` | ✅ Done — CPT ranking, QR attribution vs 0.3% Nigerian benchmark, position/size insights |
| Video Creative Framework | `/api/creative/video`, `use-media-upload.ts` | ✅ Done — first-frame canvas extraction, hook/visual/sound-off/CTA scoring via vision |
| Creative Compare Vision | `/api/creative/compare` (updated) | ✅ Done — base64 image/video frames passed to Sonnet 4.6 vision |
| Creative Client media upload | `creative-client.tsx` (updated) | ✅ Done — image + video upload in Compare tab; new Video Analysis tab (4th tab) |
| Pre-Post media upload | `pre-post-widget.tsx` (updated) | ✅ Done — split image/video buttons, canvas frame extraction, video-aware UI |
| Influencer Re-analyse | `influencers-client.tsx` (updated), `/api/influencers/[id]/reanalyse` | ✅ Done — Re-analyse button on list card regenerates brand_fit.risk_factors; fixes stale food-industry inference |

**Migration applied:** `supabase/migrations/20260629000001_email_connectors.sql` — `email_connectors` + `email_campaign_snapshots` tables with RLS

### Methodology page ✅ (session 2026-06-20, commit pending)

| Feature | Route | Status |
|---|---|---|
| Methodology page | `/dashboard/methodology` | ✅ Done — 15 methodology sections, readable for marketing professionals |
| Detailed methodology doc | `METHODOLOGY.md` | ✅ Done — exact formulas, calibration rationale, benchmarks, limitations |
| Nav update | `dashboard-nav.tsx` — Platform section | ✅ Done |

### Phase 3 — Not yet built

| Feature | Notes |
|---|---|
| Audio Transcription Module | Whisper pipeline for radio spot transcription; pending API access |
| BrandPulse JS Pixel / SDK | Website pixel for Action/Loyalty direct data capture |
| WhatsApp Broadcasting | Campaign-level message sends for survey distribution |
| Competitive SOV auto-discovery | Automated competitor handle detection from social conversation |
| Brand Tracking Panel | Monthly recurring survey panel for longitudinal awareness tracking |
| Sector Benchmarking | BHI/SOV/NPS vs Nigerian category averages (requires peer data aggregation) |
| Media Mix Modelling (MMM) Lite | Regression-based multi-channel attribution — top CMO request |

---

## Current tech decisions (canonical)

| Decision | What was decided | Why |
|---|---|---|
| Maps | `react-map-gl` v8.1.1 wrapping mapbox-gl v3.24.0 | Raw mapbox-gl breaks Tailwind v4 CSS; react-map-gl handles worker + CSS internally |
| Mapbox CSS | CDN `<link>` in root `layout.tsx` | Tailwind v4 processes all CSS imports from node_modules and breaks mapbox CSS |
| AI routing | Anthropic-only (Haiku 4.5 / Sonnet 4.6 / Opus 4.8) | NVIDIA NIM account pending verification |
| Model display | Never show model name in UI | User preference |
| Form submissions | `useActionState` with `pending` flag | Prevents double-submit on all server action forms |
| Form persistence | localStorage per entity ID, cleared on success | Prevents data loss across sessions |
| Success pattern | Success screen (not redirect) with navigation links | `redirect()` in server actions prevents client state updates |
| Button-as-link | `buttonVariants()` class on `<Link>`, not `<Button asChild>` | Button uses `@base-ui/react/button` which has no `asChild` prop |
| Tenancy | RLS via `is_workspace_member()` only — never filter in app code | Security + simplicity |
| Background jobs | Inngest for ALL async work | Handles retries, timeouts, step functions |

---

## Session: 2026-06-14 — Phase 3 Items 1-5 (commit TBD)

**What was built (30+ files across 5 modules):**

1. **Cultural Intelligence Engine** (`/dashboard/cultural`):
   - CRS score (avg `cultural_score` from `pre_post_analyses`), drift badge (last 7d vs prior 23d), emotion resonance bar (joy+trust+anticipation / total)
   - Cultural Calendar: 10 hardcoded 2026 Nigerian/West African moments, filtered to future dates, next 2 within 45 days shown with "Generate activation ideas" button
   - Activation ideas → POST `/api/cultural/activation-ideas` → claude-sonnet-4-6 → 4 ideas with title, description, channel, effort
   - "Cultural" nav link added (Globe icon) between Funnel and Competitive

2. **Influencer Intelligence** (`/dashboard/influencers`):
   - Add influencer form (name, handle, platform, category, followers)
   - 4 stat tiles: total, active, avg Cultural IQ, high-risk count
   - Per-influencer cards with status badges, CIQ badge (green ≥70, amber ≥50, red <50), risk badge (Low/Medium/High)
   - "Score with AI" → POST `/api/influencers/[id]/score` → claude-sonnet-4-6 → cultural_iq, risk_score, ai_notes
   - "Influencers" nav link added (Users icon)

3. **Creative Analysis** (`/dashboard/creative`):
   - 3-tab layout: Compare (A/B), Identity Check, Competitor Watch
   - Compare: 5 scored dimensions per creative (engagement, cultural resonance, tone, clarity, risk), winner badge
   - Identity: consistency score + strengths/drift warnings/adjustments across up to 3 captions
   - Competitor Watch: tone, cultural fit, engagement potential, counter-positioning ideas
   - History section showing last 5 analyses

4. **Competitive Intelligence deep build** (`/dashboard/competitive`):
   - Full rebuild: 4-tab layout (Briefing | ESOV League | Sightings | Scorecard)
   - Sightings feed: log billboard/event/digital/print/tv/radio/activation/pr sightings with form; feeds competitive briefing
   - ESOV League table: SOV% minus market share %, YOU badge, colour-coded
   - Scorecard: side-by-side comparison table (SOV, sentiment, content volume, market position)
   - Monday 8am Lagos cron (`TZ=Africa/Lagos 0 8 * * 1`) → AI briefing per brand + Resend email

5. **AI Command Layer v2** (embedded in `/dashboard/ask`):
   - Business Case: board-ready structured output (claude-opus-4-8) with outcomes, risk factors, Go/No-Go recommendation
   - Monthly Report: pulls 30d sentiment/SOV/survey/social/pre-post data, generates narrative, emails via Resend
   - Funnel Diagnostic: per-stage root cause diagnosis with effort-rated actions (wired to Funnel page)
   - V2Tools grid rendered above chat input on Ask AI page

**Migrations applied:**
- `20260622000000_visual_mentions.sql` (prior session)
- `20260623000000_phase3_tables.sql` (influencers, competitor_sightings, weekly_briefings, creative_analyses)

**Build:** ✅ 82 routes, TypeScript clean, no warnings

---

## Active session: 2026-06-15

**What was built in the previous session (commits d2ae956, 9879510):**
1. `BUILD_STATUS.md` created + CLAUDE.md AI routing updated (NIM removed)
2. Campaigns nav restructured — expandable section with OOH + Events as sub-items; Digital/Radio/TV/Print as "Phase 3 — Soon" chips
3. Survey distribution — "Send survey" panel with WhatsApp share link + email batch send (Resend, 50/batch)
4. Competitor management settings page — full CRUD at `/dashboard/settings/competitors`
5. Campaign performance tab — aggregated OOH visits, event leads, spend, CPV, CPL efficiency ratios

**What was built this session (commits 34770bc, d4baeaa):**

1. **BrandPulse SDK + Lifecycle integrations — architecture decided (PRD updated, build Phase 3):**
   - SDK-first approach: BrandPulse JS Pixel + React/Flutter SDK → `sdk_events` table feeds Action/Loyalty/Advocacy stages
   - GA4 connector (OAuth, daily Inngest cron, maps GA4 events to funnel stages)
   - Paystack/Flutterwave webhook connector (purchase → Action; repeat purchase → Loyalty)
   - App Store / Google Play rating fetcher (weekly Inngest cron, haiku sentiment on reviews)
   - Mailchimp/Brevo email connector for loyalty signals
   - Looker explicitly excluded (wrong tier). Mixpanel/Amplitude optional Phase 4.
   - PRD Documents 2 (new section 5.7) and 3 (Phase 3 items 9+10) fully updated.

2. **Survey system — 6 templates + template picker** (commit d4baeaa):
   - Template library at `src/lib/survey-templates.ts` — all 6 templates with full question sets
   - New Survey dialog is now a 2-step flow: template picker → name → create
   - Templates: Awareness Intercept (2Q/15s), Quick Pulse (3Q/45s), Awareness Check (5Q/90s), Post-Event (8Q/2min), Brand Perception Audit (12Q/3min), Post-Purchase NPS (5Q/60s)
   - Survey list shows template label in subtitle row

3. **NPS Tracker** (`/dashboard/surveys/nps`):
   - 12-week rolling NPS trend chart (Recharts LineChart with ReferenceLine at 0)
   - Promoter / Passive / Detractor KPI tiles with %
   - Trend direction computed (rising/falling/stable: 4-week window comparison)
   - "Diagnose with AI" → claude-sonnet-4-6 → detractor root causes, promoter archetype, 3 90-day recommendations grounded in Nigerian market
   - Pulls verbatim text answers from survey_responses to enrich AI context
   - Accessible via "NPS Tracker" button on the Surveys page header

4. **Unified Brand Funnel page** (`/dashboard/funnel`) — 6-stage waterfall with live data scoring:
   - Awareness: SOV from `sov_snapshots.social_sov`
   - Consideration: avg `engagement_rate` from `social_posts` (last 30 days), scaled × 10
   - Preference: avg `sentiment_daily.social_score` (last 14 days)
   - Action: event lead-capture rate (60pts) + OOH vanity visits (40pts)
   - Loyalty: NPS from `survey_responses` rescaled 0-100
   - Advocacy: organic share rate from `social_posts`
   - Drop-off % between stages colour-coded (green ≤15%, amber 16-30%, red >30%)
   - "Diagnose with AI" button → POST `/api/funnel/diagnose` → claude-sonnet-4-6 → 3 West-Africa-specific recommendations
   - "Funnel" added to sidebar nav between Pre-Post and Competitive

**Phase 3 channel architecture (planned — see PRD Document 2 sections 7.9–7.12):**
- **Digital** (7.9): Meta Ads + X Ads + Google Ads OAuth; create/manage campaigns from BrandPulse; daily ROAS/CTR/CPC pull; AI creative fatigue alerts + budget reallocation
- **Radio** (7.10): Excel/CSV media plan import (Claude maps columns); 40+ Nigerian station DB; per-spot tracker; daypart efficiency ranking
- **TV** (7.11): Same import flow; NTA/AIT/Channels/DSTV channel DB; GRP/CPRP tracking; underdelivery alerts
- **Print** (7.12): Publication DB; QR is PRIMARY attribution; per-placement QR auto-generation; CPT analytics

---

## Session: 2026-06-14 — Full Sentiment Engine + Brand Equity Tracker (commit bc61244)

**What was built (9 files, 1073 insertions):**

5. **Full Sentiment Engine** (`/dashboard/sentiment` extended):
   - Expanded from 7-day to 12-week view; `weeklyAggregate()` reduces 84 daily rows to 12 weekly points for clean chart
   - `computeAlerts()` detects: crashes (delta ≤ -20 = critical, ≤ -10 = warning), spikes (≥ +20 = watch), sustained negativity (>60% negative for 3+ consecutive days = warning); last 4 alerts shown as severity-coded banners
   - **Emotion Wheel** — Recharts PieChart donut using Plutchik 8-emotion palette; reads `emotion_distribution` JSONB from `sentiment_daily`
   - **Topic Clusters** — "Analyse topics" button → POST `/api/sentiment/clusters` → claude-haiku-4-5-20251001 (Pidgin/Nigerian slang tier) → 3-5 thematic cluster cards with verbatim quotes
   - `SentimentTrendChart` updated with optional `weekly` prop (switches XAxis dataKey to `weekLabel`)

6. **Brand Equity Tracker** (`/dashboard/brand-equity`):
   - Full 7-component BHI via `computeFullBHI()` in `src/lib/bhi.ts` with renormalized weights:
     Awareness 20% (SOV), Salience 15% (survey aided awareness rate), Sentiment 20% (14-day avg), Perception 15% (perception_audit q2-q9), Cultural Resonance 15% (Phase 3 = null), Blended SOV 10%, EMV 5%
   - **ESOV Engine**: live SOV card + editable market share % input + posture band badge (Growth Mode / Mild Growth / Parity / Decline Risk / Critical Decline)
   - **Budget-to-ESOV Simulator**: user enters target ESOV % → estimated additional NGN spend + time-to-impact estimate
   - **Perception Radar**: Recharts RadarChart across 8 brand dimensions (Quality, Trust, Innovation, Value, Cultural Relevance, Accessibility, Reliability, Emotional Connection)
   - **EMV tile**: formatted as ₦X.XM with CPM/CPE benchmark notes
   - NPS summary tile linking to full NPS Tracker
   - "Brand Equity" nav item added between Sentiment and Surveys (Award icon)

---

## Key file map (quick navigation)

| Purpose | Path |
|---|---|
| AI client (Anthropic-only) | `src/lib/ai/client.ts` |
| AI ask endpoint | `src/app/api/ai/ask/route.ts` |
| AI conversation history endpoint | `src/app/api/ai/conversations/[id]/route.ts` |
| BHI gauge component | `src/components/dashboard/bhi-gauge.tsx` |
| OOH intelligence map | `src/components/ooh/ooh-map-client.tsx` |
| OOH per-site map | `src/components/ooh/ooh-site-map-client.tsx` |
| Campaign detail page | `src/app/dashboard/campaigns/[id]/page.tsx` |
| Campaign detail client | `src/components/campaigns/campaign-detail-client.tsx` |
| Event setup wizard | `src/components/events/event-wizard.tsx` |
| Ambassador PWA | `src/app/ambassador/[token]/page.tsx` |
| Event debrief form | `src/components/events/debrief-form.tsx` |
| Event actions (server) | `src/app/dashboard/events/actions.ts` |
| Survey detail page | `src/app/dashboard/surveys/[id]/page.tsx` |
| Survey send panel | `src/app/dashboard/surveys/[id]/send-survey.tsx` |
| Competitor settings | `src/app/dashboard/settings/competitors/page.tsx` |
| Campaign performance tab | `src/components/campaigns/campaign-detail-client.tsx` |
| Brand Funnel page | `src/app/dashboard/funnel/page.tsx` |
| Survey template library | `src/lib/survey-templates.ts` |
| NPS Tracker page | `src/app/dashboard/surveys/nps/page.tsx` |
| NPS diagnosis API | `src/app/api/surveys/nps-diagnosis/route.ts` |
| Brand Funnel client | `src/app/dashboard/funnel/funnel-client.tsx` |
| Funnel AI diagnosis API | `src/app/api/funnel/diagnose/route.ts` |
| Public survey form | `src/app/survey/[id]/survey-form.tsx` |
| Mobile nav drawer | `src/components/dashboard/mobile-nav.tsx` |
| E6 visual scan API | `src/app/api/event/visual-scan/route.ts` |
| E6 brand detector (vision) | `src/lib/vision/brand-detector.ts` |
| E6 visual mentions component | `src/components/events/visual-mentions.tsx` |
| Visual mentions migration | `supabase/migrations/20260622000000_visual_mentions.sql` |
| Sentiment emotion wheel | `src/app/dashboard/sentiment/emotion-wheel.tsx` |
| Sentiment topic clusters | `src/app/dashboard/sentiment/topic-clusters.tsx` |
| Topic clusters API | `src/app/api/sentiment/clusters/route.ts` |
| Brand Equity page | `src/app/dashboard/brand-equity/page.tsx` |
| Brand Equity client | `src/app/dashboard/brand-equity/brand-equity-client.tsx` |
| Full BHI computation | `src/lib/bhi.ts` (computeFullBHI) |
| Competitive client | `src/app/dashboard/competitive/competitive-client.tsx` |
| AI ask full page | `src/app/dashboard/ask/page.tsx` |
| Root layout (Mapbox CSS link) | `src/app/layout.tsx` |
| Inngest functions | `src/lib/inngest/functions/` |
| Social OAuth connect | `src/app/api/social/connect/[platform]/route.ts` |
| Vanity link redirect | `src/app/go/[slug]/route.ts` |
