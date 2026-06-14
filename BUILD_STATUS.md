# BrandPulse AI — Build Status

> Feed this file into your project chat at the start of each session to bring it up to date.
> Updated after every pushed session. Last updated: 2026-06-15.

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
| E6 — Visual brand mention detector | Medium | Hashtag crawl + Claude Vision for logo/merch detection at events |
| ~~Unified Brand Funnel page~~ | ~~Medium~~ | ✅ Done this session — `/dashboard/funnel` |
| Audio transcription module | Low | Whisper + Haiku pipeline |
| Full survey system (all 6 templates, WhatsApp delivery) | Low | Current survey is single-template; need 6 templates + email/WhatsApp dispatch |
| Full sentiment engine (timeline, clusters, emotion wheel) | Low | Basic sentiment live; topic clusters and emotion wheel pending |
| Brand Equity Tracker (full ESOV, radar, EMV) | Low | BHI basic live; full weighted BHI + ESOV engine pending |

### Phase 3+ — Not started
Cultural Intelligence Engine (CRS, cultural calendar, drift monitor), Influencer Intelligence, Creative Analysis, Competitive Intelligence deep build (scorecard, ESOV league, weekly briefing cron), AI Command Layer v2 (business case generator, PDF reports).

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

## Active session: 2026-06-15

**What was built in the previous session (commits d2ae956, 9879510):**
1. `BUILD_STATUS.md` created + CLAUDE.md AI routing updated (NIM removed)
2. Campaigns nav restructured — expandable section with OOH + Events as sub-items; Digital/Radio/TV/Print as "Phase 3 — Soon" chips
3. Survey distribution — "Send survey" panel with WhatsApp share link + email batch send (Resend, 50/batch)
4. Competitor management settings page — full CRUD at `/dashboard/settings/competitors`
5. Campaign performance tab — aggregated OOH visits, event leads, spend, CPV, CPL efficiency ratios

**What was built this session (commit 34770bc):**
1. **Unified Brand Funnel page** (`/dashboard/funnel`) — 6-stage waterfall with live data scoring:
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
| Brand Funnel client | `src/app/dashboard/funnel/funnel-client.tsx` |
| Funnel AI diagnosis API | `src/app/api/funnel/diagnose/route.ts` |
| Competitive client | `src/app/dashboard/competitive/competitive-client.tsx` |
| AI ask full page | `src/app/dashboard/ask/page.tsx` |
| Root layout (Mapbox CSS link) | `src/app/layout.tsx` |
| Inngest functions | `src/lib/inngest/functions/` |
| Social OAuth connect | `src/app/api/social/connect/[platform]/route.ts` |
| Vanity link redirect | `src/app/go/[slug]/route.ts` |
