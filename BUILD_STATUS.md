# BrandPulse AI — Build Status

> Feed this file into your project chat at the start of each session to bring it up to date.
> Updated after every pushed session. Last updated: 2026-06-14.

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
| Unified Brand Funnel page | Medium | 6-stage waterfall (Recharts), drop-off %, green/amber/red, AI diagnosis |
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

## Active session: 2026-06-14

**What was just completed (committed and deployed):**
1. AI conversation history fix — new `GET /api/ai/conversations/[id]` endpoint; page now loads full messages
2. Debrief form — success screen + localStorage draft persistence + useActionState anti-double-submit
3. BHI gauge redesign — semicircle arc, zone badge, component tiles, sparkline
4. NIM removed from `lib/ai/client.ts` — Anthropic-only routing
5. Competitive Intel UI — model name removed from display grid
6. OOH maps — migrated to react-map-gl; Mapbox CSS served from CDN

**Phase 3 channel architecture (planned — see PRD Document 2 sections 7.9–7.12):**
- **Digital** (7.9): Meta Ads + X Ads + Google Ads OAuth connections; create/manage campaigns and ad creatives from BrandPulse; daily performance pull (ROAS/CTR/CPC/CPA/frequency); AI creative fatigue alerts, budget reallocation recommendations, anomaly detection
- **Radio** (7.10): Excel/CSV media plan import (Claude reads and maps columns automatically); 40+ Nigerian station database with listenership benchmarks; per-spot schedule tracker; daypart efficiency AI analysis; delivery vs plan
- **TV** (7.11): Same media plan import; NTA/AIT/Channels/DSTV channel database with TVR per daypart; GRP/CPRP tracking; underdelivery alerts with make-good negotiation recommendations
- **Print** (7.12): Punch/Vanguard/Guardian/BusinessDay/etc. publication database with circulation and readership multipliers; QR is the PRIMARY attribution method for print (unlike OOH); per-placement QR auto-generation; CPT and scan-rate analytics

**Nav restructure (implementing this session):**
- Campaigns becomes an expandable sidebar section
- OOH and Events move under Campaigns as sub-items
- Digital / Radio / TV / Print appear as "Coming Soon" sub-items

**Building this session:**
1. Nav restructure — Campaigns expandable with OOH + Events as sub-items
2. Survey distribution — "Send survey" UI with shareable link + email list + WhatsApp share link
3. Competitor management settings — add/edit/remove tracked competitors
4. Campaign performance view — aggregated metrics on campaign detail (OOH visits, event leads, spend vs reach)

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
| Competitive client | `src/app/dashboard/competitive/competitive-client.tsx` |
| AI ask full page | `src/app/dashboard/ask/page.tsx` |
| Root layout (Mapbox CSS link) | `src/app/layout.tsx` |
| Inngest functions | `src/lib/inngest/functions/` |
| Social OAuth connect | `src/app/api/social/connect/[platform]/route.ts` |
| Vanity link redirect | `src/app/go/[slug]/route.ts` |
