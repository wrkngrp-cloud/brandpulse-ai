# BrandPulse AI — Build Status

> Feed this file into your project chat at the start of each session to bring it up to date.
> Updated after every pushed session. Last updated: 2026-07-03.

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
| ~~Survey distribution (email + WhatsApp send)~~ | ~~High~~ | ✅ Done — "Send survey" panel, WhatsApp share link + Resend email batches |
| ~~Competitor management settings~~ | ~~High~~ | ✅ Done — full CRUD at `/dashboard/settings/competitors` |
| ~~Campaign performance view~~ | ~~High~~ | ✅ Done — aggregated OOH visits, event leads, spend, CPV/CPL |
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

### Phase 3 — Remaining gaps

| Feature | Notes |
|---|---|
| Audio Transcription Module | Whisper pipeline for radio spot transcription; pending API access |
| ~~BrandPulse JS Pixel / SDK~~ | ✅ Done — `POST /api/sdk/event`, `sdk_events` table, pixel settings at `/dashboard/settings/pixel` |
| ~~WhatsApp Broadcasting~~ | ✅ Done — Inngest batch broadcast, `/dashboard/whatsapp` (hidden — needs SIM) |
| Competitive SOV auto-discovery | Automated competitor handle detection from social conversation |
| ~~Brand Tracking Panel~~ | ✅ Done — `/dashboard/surveys/panels`, all CRUD APIs, Inngest cron (9am Lagos daily), email + WhatsApp dispatch |
| Sector Benchmarking | BHI/SOV/NPS vs Nigerian category averages (requires peer data) |
| ~~Media Mix Modelling Lite~~ | ✅ Done — `/dashboard/mmm`, activity-weighted attribution model |

---

### Phase 4 — WhatsApp Deep Integration ✅ (2026-06-24)

**Architecture: Model A — BrandPulse-owned WABA, Meta Cloud API v20.0**
Users never touch an API key. Contacts + templates managed entirely inside BrandPulse UI.

| Component | Route / File | Status |
|---|---|---|
| DB migration | `supabase/migrations/20260630000001_whatsapp.sql` | ✅ |
| Webhook (verify + delivery callbacks + STOP opt-out) | `POST /api/whatsapp/webhook` | ✅ |
| Templates API (fetch approved Meta templates) | `GET /api/whatsapp/templates` | ✅ |
| Contact CSV import (Nigerian phone normalisation) | `POST /api/whatsapp/contacts/import` | ✅ |
| Campaign send (triggers Inngest broadcast) | `POST /api/whatsapp/send` | ✅ |
| Broadcast Inngest function (batched, 1k/day limit) | `src/lib/inngest/functions/whatsapp-broadcast.ts` | ✅ |
| WhatsApp hub page (stats + campaign history + send sheet) | `/dashboard/whatsapp` | ✅ |
| Contact management page (CSV upload + list) | `/dashboard/whatsapp/contacts` | ✅ |
| WhatsApp card on Connectors page | `src/components/dashboard/whatsapp-connect-card.tsx` | ✅ |
| Nav link (Surveys & Messaging section) | `dashboard-nav.tsx` | ✅ |

Required env vars (add to Vercel):
- `WHATSAPP_PHONE_NUMBER_ID` — from Meta Business Manager → WhatsApp → API Setup
- `WHATSAPP_BUSINESS_ACCOUNT_ID` — WABA ID
- `WHATSAPP_ACCESS_TOKEN` — permanent system user token
- `WHATSAPP_APP_SECRET` — for webhook HMAC verification
- `WHATSAPP_VERIFY_TOKEN` — any string you choose for webhook handshake

Webhook URL to register in Meta: `https://brandpulse.ai/api/whatsapp/webhook`

---

### Phase 4 — AI Visibility Tracker, Voice Builder, SDK/Pixel, Billing ✅ (2026-06-24)

| Feature | Route / File | Status |
|---|---|---|
| **AI Visibility Tracker** | | |
| DB migration | `supabase/migrations/20260701000001_ai_visibility.sql` | ✅ |
| Inngest weekly cron (every Monday) | `lib/inngest/functions/ai-visibility.ts → aiVisibilityWeeklyCron` | ✅ |
| Inngest on-demand function | `lib/inngest/functions/ai-visibility.ts → aiVisibilityOnDemand` | ✅ |
| Trigger API | `POST /api/ai-visibility/check` | ✅ |
| Scores API | `GET /api/ai-visibility/scores` | ✅ |
| Dashboard page + client | `/dashboard/ai-visibility` | ✅ |
| Nav link (Intelligence section) | `dashboard-nav.tsx` | ✅ |
| **AI Brand Voice Builder** | | |
| UI + API | `/dashboard/voice-builder`, `POST /api/ai/brand-voice-builder` | ✅ (was already built) |
| `getActiveBrandId` fix | `api/ai/brand-voice-builder/route.ts` | ✅ fixed |
| **BrandPulse SDK / Pixel** | | |
| DB migration | `20260624003000_sdk_events.sql` (sdk_events + pixel_configs) | ✅ (was already built) |
| Track endpoint | `POST /api/sdk/event` (rate-limited via Upstash) | ✅ (was already built) |
| Pixel setup | `GET/POST /api/sdk/pixel` | ✅ fixed (getActiveBrandId) |
| Settings UI | `/dashboard/settings/pixel` | ✅ (was already built) |
| **Tiered Billing (Stripe)** | | |
| Stripe lib | `src/lib/stripe.ts` (PLAN_DISPLAY, STRIPE_PRICES) | ✅ (was already built) |
| DB schema | `workspaces.stripe_*`, `plan_limits`, `usage_events` | ✅ (was already built) |
| Checkout session | `POST /api/billing/checkout` | ✅ (was already built) |
| Customer portal | `POST /api/billing/portal` | ✅ (was already built) |
| Webhook handler | `POST /api/billing/webhook` | ✅ (was already built) |
| Billing UI | `/dashboard/settings/billing` | ✅ (was already built) |

Required env vars for AI Visibility Tracker (at least one):
- `OPENAI_API_KEY` → ChatGPT (GPT-4o mini)
- `GOOGLE_AI_API_KEY` → Gemini 2.0 Flash
- `PERPLEXITY_API_KEY` → Perplexity Sonar

Required env vars for Billing:
**DEFERRED — post-beta. Will replace Stripe with Paystack when billing is activated.**
Current Stripe code stays in place but is not deployed/configured until after beta.

### Phase 4 — Items built this session (commit pending, 2026-06-24)

| Feature | Route / Key Files | Status |
|---|---|---|
| GA4 OAuth "Connect with Google" | `GET /api/connectors/ga4/auth`, `GET /api/connectors/ga4/callback` | ✅ CSRF state cookie, token exchange, GA4 Admin API property discovery, stores to ga4_connections |
| GA4 token auto-refresh | `src/app/api/connectors/ga4/sync/route.ts` | ✅ Checks token_expiry, refreshes if within 2 min, updates ga4_connections |
| GA4 connect card | `src/components/dashboard/ga4-connect-card.tsx` | ✅ Google OAuth button replaces manual form; success/error toast on redirect-back |
| Google Sign-In (auth) | `src/components/auth/google-sign-in-button.tsx` | ✅ Supabase signInWithOAuth; loading state with Loader2 spinner |
| Login + Signup — Google button | `src/app/(auth)/auth/login/page.tsx`, `src/app/(auth)/auth/signup/page.tsx` | ✅ Google button + "or continue with email" divider; form id + form= attribute pattern |
| New Google user provisioning | `src/app/api/auth/callback/route.ts` | ✅ Checks workspace_members after OAuth; creates workspace + member + blank brand; redirects to /onboarding |
| Connector brand lookup fix | All 6 connector routes (ga4, paystack, flutterwave, mailchimp, brevo) | ✅ Replaced .limit(1).single() brand lookups with getActiveBrandId() / getActiveBrand() |
| GA4 sync metricAggregations fix | `src/app/api/connectors/ga4/sync/route.ts` | ✅ Added metricAggregations: ['TOTAL'] so totals[] populates in GA4 Data API response |
| sdk_events insert fix | `src/app/api/connectors/ga4/sync/route.ts` | ✅ Switched upsert → insert (INDEX not UNIQUE on brand_id+event_type) |
| Connectors page brand fix | `src/app/dashboard/connectors/page.tsx` | ✅ Uses getActiveBrand() not .limit(1).maybeSingle() |

### Phase 6 — Retention & Advocacy OS ✅ (commits a18490e + 29e049a, 2026-06-26)

All planned Phase 6 modules are now built.

| Feature | Route | Key files |
|---|---|---|
| Retention Risk view | `/dashboard/retention` | `retention-client.tsx`, `GET /api/retention/risk` |
| Promoter Activation + Referral Framework | `/dashboard/advocacy` | `advocacy-client.tsx`, `/api/promoters/*`, `/api/referral-codes/*` |
| Advocacy Dashboard + Leaderboard | `/dashboard/advocacy` (tab 2) | same as above |
| Public Referral redirect + click tracking | `/ref/[code]` | IP+UA dedup, 24h window |
| Customer Data Platform (CDP) | `/dashboard/cdp` | `cdp-client.tsx`, `POST /api/cdp/sync`, `GET /api/cdp/profiles` |
| Social Proof Score | `/dashboard/advocacy` | advocacy score computed from UGC + NPS promoter rate |
| Marketplace Intelligence | `/dashboard/marketplace` | Jumia/Konga shelf performance, product reviews, competitor pricing |
| Budget Pacing | `/dashboard/budget` | live spend vs plan, channel-level pacing alerts |
| Loyalty Engine | `/dashboard/loyalty` | tier system (points, tiers, rewards), auto-promotion on transaction |
| A/B Testing Framework | `/dashboard/experiments` | variant management, significance calc, `confidence_target` per experiment |

**Migrations:** `20260702000001_promoters_referrals.sql`, `20260702000002_cdp.sql`, `20260702000004_marketplace.sql`, `20260702000005_budget.sql`, `20260702000006_loyalty.sql`, `20260702000007_ab_testing.sql`

---

### Phase 6 — AI Power Tools, AI Visibility, GA4 OAuth, Google Sign-In ✅ (commit 4ee427a, 2026-06-24)

| Feature | Route / File | Status |
|---|---|---|
| AI Power Tools tabs on Ask AI page | `/dashboard/ask` + `v2-tools.tsx` | ✅ |
| Business Case expansion (board-grade) | `business-case-client.tsx`, `POST /api/ai/business-case` | ✅ Sonnet 4.6 (Opus unavailable) |
| Influencer ROI tracker tab | `/dashboard/influencers` | ✅ |
| Portal competitive context | `/portal/[token]` | ✅ |
| AI Visibility Tracker | `/dashboard/ai-visibility` | ✅ (hidden — needs AI platform API key) |
| WhatsApp Deep Integration | `/dashboard/whatsapp` | ✅ (hidden — needs new SIM + Meta WABA) |

---

### Phase 6 — Creative Intelligence, Voice Builder v2, Creative Library ✅ (commit 86e9b1f, 2026-06-28)

| Feature | Route / File | Status |
|---|---|---|
| Voice Builder — Retune Caption tab | `/dashboard/voice-builder` | ✅ Rewrites copy in saved brand voice |
| Voice Builder — Generate Captions tab | `/dashboard/voice-builder` | ✅ Generates N variations from a concept |
| New API | `POST /api/ai/brand-voice/caption` | ✅ mode=retune / mode=generate; Haiku 4.5 |
| Creative Library | `/dashboard/creative-library` | ✅ Vetted asset vault; filter by type/ads-ready; drawer with performance data; multi-select → Create Ad Set |
| Nav restructure | Creative Intelligence section | ✅ Creative Lab (collapsible) + Creative Library + A/B Testing |

**Migration:** `20260702000008_creative_assets.sql` (`creative_assets` table with RLS)

**RLS bug fixed (commit f43edd9):** `creative_assets` policy was `is_workspace_member(brand_id)` — passes brand UUID as workspace_id → always false. Fixed to subquery: `is_workspace_member((SELECT workspace_id FROM brands WHERE id = brand_id))`. Migration: `20260702000011_fix_creative_assets_rls.sql`.

---

### Phase 6 — Creative Fatigue Monitor ✅ (commit e0bf9a1, 2026-06-28)

| Feature | Route / File | Status |
|---|---|---|
| Creative Fatigue Monitor | `/dashboard/creative-fatigue` | ✅ Fatigue score per active creative |
| Alert levels | Critical / Watch / Refresh Soon | ✅ Based on frequency + CTR decline + days running |
| CTAs | Retune Caption → Voice Builder; Find Replacement → Creative Library; A/B Test → Experiments | ✅ |

**Migration:** `20260702000009_creative_analyses_result.sql` — added `analysis_type`, `input_data`, `result` JSONB to `creative_analyses`.

---

### Phase 6 — OOH Geo Attribution + Geo-Retargeting Audiences ✅ (commit b6ca016, 2026-06-28)

| Feature | Route / File | Status |
|---|---|---|
| OOH Geo Attribution | OOH site detail page | ✅ Captures Vercel geo headers (lat/lng/city) in `ooh_visits` at zero cost |
| Geo Attribution Panel | `geo-attribution-panel.tsx` | ✅ Visits by city, attribution method split, confidence score, visit feed |
| Geo-Retargeting Audiences | `POST /api/ooh/geo-audiences` | ✅ Create audience config per OOH site (Meta or Google), saved to `ooh_geo_audiences` |
| Sync to Meta/Google Ads | GeoAttributionPanel sync button | ⚠️ Routes to Connectors — requires Meta `ads_management` OAuth permission (not yet built on Meta connector) |

**Migration:** `20260702000010_ooh_geo_attribution.sql` — extended `ooh_visits` (geo_lat, geo_lng, geo_city, geo_state, matched_site_id, attribution_method, attribution_confidence); new `ooh_geo_audiences` table.

**Geo Audience sync (2026-06-28):** `POST /api/ooh/geo-audiences/[id]/sync` — calls Meta reach estimate API with the site's lat/lng + fence radius. Returns `users_lower_bound` / `users_upper_bound`, stores as `estimated_reach`, marks status `active`. Requires Meta Ads connected in Connectors.

**Meta Ads Connector (2026-06-28):** `MetaAdsConnectCard` added to Connectors page under Paid Media. Shows connection status from `digital_ad_accounts`. Connect → `GET /api/ads/meta/connect?return_to=connectors` (scope: `ads_read,ads_management,read_insights`). Disconnect → `DELETE /api/ads/meta/connect`. Full OAuth: connect stores `{userId, brandId, returnTo}` in Redis state (10 min TTL); callback reads brandId directly (no DB brand lookup — multi-brand safe); redirects back to the originating page (`connectors` or `digital`). Daily sync: `metaAdsDailySync` Inngest function (5 AM Lagos), token auto-refresh 7 days before expiry, upserts into `digital_performance_daily`. Env vars required: `META_APP_ID`, `META_APP_SECRET`. Redirect URI to whitelist in Meta App Dashboard: `https://brandpulse.ai/api/ads/meta/callback`.

**Meta Data Deletion callback (2026-06-28):** `POST /api/auth/meta/deauthorize` — validates signed_request (HMAC-SHA256), returns `{url, confirmation_code}`. Register in Meta App Dashboard → Facebook Login → Data Deletion Request URL: `https://brandpulse.ai/api/auth/meta/deauthorize`. Required before App Review submission.

---

### QA Pass + Nav Restructure ✅ (commit 5b93feb, 2026-06-27)

Nav now has 9 logical sections following marketer workflow:  
**Brand Health → Intelligence → Campaigns → Creative → Research → Measurement → Growth → Reports → Setup**

**P0 bug fixes:**
- Business Case `fmtNGN`: removed kobo÷100 division (values stored in NGN)
- Business Case spend efficiency: `/100M` → `/1M` (BHI per ₦1M metric)
- Retention redirect: `/login` → `/auth/login`
- A/B Testing: `calcSignificance` uses `experiment.confidence_target` (was hardcoded 0.05)
- Loyalty: tier auto-promotion on every transaction

**P1 bug fixes:**
- MMM description: clarified as activity-weighted attribution (not causal MMM)
- Geo-Lift: SerpAPI warning banner when `SERPAPI_KEY` not configured
- Voice Builder: fetches active brand name on mount

---

### Field Intelligence (FSO PWA + Dashboard) ✅ (commit 629cf67, 2026-06-22)

| Feature | Route | Status |
|---|---|---|
| Field Intelligence dashboard | `/dashboard/field-intelligence` | ✅ FSO team management, outlet visit reports |
| FSO PWA (field agent mobile) | built in field-intelligence | ✅ |
| Demo seed | 06acead | ✅ FSO teams, reports, outlets |

---

### Phase 7 — World-View Funnel Rebuild ✅ (commits 3bfa09f, 4b6c0b4, 970a2b8, 2026-06-28–29)

| Feature | Notes |
|---|---|
| Multi-source BHI breakdown | Every BHI component card expands to show contributing data sources, raw values, redistributed weights, 0–100 sub-scores |
| Full funnel signal rebuild | 9+6+6+7+5+6 live signals across Awareness/Consideration/Preference/Action/Loyalty/Advocacy via `computeStageComposite()` — missing signals redistribute weight instead of zeroing the stage |
| Funnel data points breakdown | Click any stage's source row to see each contributing signal, its weight %, and its score |

Awareness composite (world-view model, also used by BHI): Social SOV 30%, OOH Reach 25%, Event Attendance 20%, Digital Impressions 15%, Influencer Reach 10%.

### Phase 7 — Multi-Industry Platform Foundation ✅ (commit ba8e216, 2026-06-29)

Brands now carry a `brand_type` (fmcg | fintech | venue | b2b_saas | marketplace | beverage_alcohol | b2b_distribution), and the funnel/BHI signal set branches by it instead of assuming FMCG for every brand. Full rationale in `docs/industry-fit-strategy.md` and `docs/funnel-signals-explained.md`; remaining scope tracked in `docs/to-100-percent-build-list.md`.

| Feature | Notes |
|---|---|
| `brand_type` on brands + settings selector | Drives funnel signal routing per vertical |
| Signal routing by vertical | Fintech drops OOH/TV/radio, adds app store rating to Preference; venue drops TV/radio, adds Google Maps rating + review velocity; SaaS/marketplace adds G2 rating; FMCG wires Field Intelligence distribution availability + stock-out rate into Awareness/Action |
| `audience_type` on mentions | consumer/creator/developer/retailer/media/general — sentiment dashboard breakdown |
| `respondent_role` on nps_records | consumer/trade_partner/retailer/developer/decision_maker/end_user — NPS cohort split in surveys UI |
| Complaint-surge detector | Daily z-score of negative mention volume vs 30d baseline; fires notification at ≥2σ (8am Lagos cron) |
| Google Maps connector (venue) | Daily Inngest sync, on-demand `POST /api/venue/sync-maps`, `VenueReputationPanel` on brand equity page |

**Migrations:** 12 new tables — `venue_traffic`, `review_platform_snapshots`, `review_aspect_sentiment`, `fintech_metrics`, `saas_metrics`, `platform_metrics`, `trade_partner_metrics`, `developer_health_snapshots`, `regulatory_mentions`, `sponsorship_events`, `brand_launch_markers`, plus `google_place_id` on brands.

### Phase 7 — Trust Pillar, BHI Presets, B2B/Dev Connectors ✅ (commits 1eb3273, 2accb7a, 2026-06-29)

| Feature | Notes |
|---|---|
| Trust Pillar (fintech) | `computeTrustScore()` — app store rating 35%, regulatory standing 30%, reliability 20%, complaint health 15%; `TrustPillarCard` on brand equity |
| Regulatory mention detector | Weekly Monday 6am Lagos cron, sweeps press mentions for 14 Nigerian regulator names × action terms → `regulatory_mentions` |
| First-party data API | `brand_api_keys` (SHA-256 hashed `bp_live_...`), `GET/POST/DELETE /api/brand/api-keys`, `POST /api/first-party/[type]` routes brand-authenticated payloads into fintech/saas/venue/platform/trade-partner metrics tables |
| BHI weight presets | `BRAND_TYPE_WEIGHTS` — 7 vertical-specific weight sets (e.g. fintech weights sentiment 25%/perception 20%, b2b_saas drops cultural resonance to 0%); badge shown in BHI header |
| Aspect-level review sentiment | Weekly Claude Haiku classifier extracts 8 aspects (food/service/ambiance/value/reliability/feature_quality/support/price_fairness) from Google Maps + app reviews → `review_aspect_sentiment` |
| G2 / Capterra connector | Weekly scrape of aggregate rating + velocity for b2b_saas/marketplace brands |
| Developer health connector | Weekly GitHub/npm/Stack Overflow snapshot for fintech/b2b_saas/marketplace brands |
| Feature/launch markers | `GET/POST/DELETE /api/brand/markers` — 7-day before/after BHI delta per marker, annotated on the BHI sparkline |

### Phase 7 — Connector QA Pass ✅ (commit 1f3695e, 2026-06-30)

9 bugs fixed across Paystack/Flutterwave webhooks (insert instead of overwrite-on-conflict; constant-time hash comparison), App Store review sync (unchained query filter was reprocessing every brand on every event; `.limit(1).single()` → `getActiveBrandId`), Pixel/SDK tracker (missing `pixel.js` loader route; conditional Upstash rate limiter so missing env vars don't crash the ingest endpoint at cold start), and a production hard-fail if `TOKEN_ENCRYPTION_KEY` falls back to the dev default.

### Phase 7 — Full Mobile Responsive Pass ✅ (commits 038c91a…555a065, 45b6492, 2026-07-01)

Every dashboard module audited and fixed for iPhone SE (375px) through tablet (768–1024px) through 4K, using Tailwind responsive classes only — no logic changes. Covers: sentiment, competitive, cultural, funnel, surveys, field intelligence, retention, advocacy, loyalty, WhatsApp, influencers, creative, OOH, events, campaigns, digital, settings, connectors, reports, AI visibility, business case. Also fixed: dashboard shell padding bug on mobile (sidebar-width padding was applying with the sidebar hidden), and the nav drawer's z-index — it was trapped inside the header's `backdrop-blur` stacking context, so it now portals to `document.body`.

### Phase 7 — Industry Selector, Dashboard Redesign, Auth Redesign ✅ (commits 0dd953a, da0e5f6, d8e09b9, 2026-07-02)

| Feature | Route / Key Files | Status |
|---|---|---|
| Industry selector in onboarding | Onboarding Screen 0 — 13 visual industry cards before AI brand analysis | ✅ `industry-config.ts` maps each industry to hidden nav paths, suggested connectors, AI prompts, key metrics |
| Industry-based nav visibility | `dashboard-nav.tsx`, `isPathHidden()` | ✅ e.g. fintech hides OOH/Radio/TV/Print/Field Intelligence/Marketplace; b2b_saas hides OOH/Broadcast/Field/Marketplace/Cultural/Geo-Lift/MMM; agencies see everything |
| Dashboard redesign — hero + widgets | `/dashboard` | ✅ AI Ask field with rotating industry prompts, 4 KPI tiles, widget controls bar |
| Widget catalog + templates | `user_dashboard_prefs` | ✅ 24 widgets / 7 categories / 4 industry templates (FMCG CMO, Fintech Growth, Agency, Field Ops); template picker on first login |
| Manual metric entry (Tier 1) | `metric_manual`, `metric_daily`, `POST/GET /api/dashboard/metrics` | ✅ Industry-specific fields, no connector required |
| Connectors hub, industry-filtered | `/dashboard/connectors` | ✅ Industry-recommended banner; Payments section hidden for fintech/b2b_saas/telco/media/insurance/healthcare/real_estate |
| Login/signup/reset redesign | `/auth/*` | ✅ Split-layout login with 4 demo account tiles (Jara, PocketPay, Pinnacle, Bridger); centered signup/reset |
| CMO Board Pack | `/dashboard/reports/board-pack` | ✅ One-page print-to-PDF + email-share report (BHI, sentiment, SOV, budget, events, NPS, manual metrics) |

### Phase 7 — Product Tour System ✅ (commits 953d817, 86202c6, 0f61159, b4aeb6e, a5546fd, 6a86593, 6decc78, 2026-07-02–03)

Built, then wired end-to-end, then fixed through several rounds of on-device QA:
- `user_tours` table (RLS) tracks unseen/in_progress/completed/skipped per user per module.
- `TourSpotlight`: animated backdrop with a real cutout ring around the target element (not just a dimmed screen), off-screen targets auto-scroll into view, keyboard nav (Escape/Arrow/Enter), centering math recomputed live (framer-motion's `animate scale` overwrites a static transform).
- Every dashboard module now has a 3–5 step tour and a "Show me around" trigger — first-visit auto-start (after the dashboard's template picker closes, not racing it) plus a persistent topbar icon (`global-tour-button.tsx`) that resolves the current module from the route via `getModuleForPath()`.
- Mobile fixes: card width now responsive (`min(340px, viewport - 32px)`), ring highlight clamps to the visible viewport, and the "Set up your dashboard" template picker was rebuilt with a pinned header/footer + internal scroll region so it can't clip off short viewports (same fix applied to the shared Dialog/Sheet primitives app-wide).
- Also this session: an app-wide casing pass — raw snake_case DB enum values (status, tone, platform, confidence, sentiment_label, etc.) rendered unstyled in several places; fixed via shared `toSentenceCase()` / `formatPlatformLabel()` helpers.

### Phase 7 — Demo Seeds ✅ (2026-07-02)

Three new full demo accounts, one per underserved vertical, each with brand_type-appropriate data (no OOH/TV/radio/print for verticals where those don't apply):
- **PocketPay** (fintech) — `commit e431801`
- **Bridger CRM** (b2b_saas) — `commit 39e7f20` — 365 sentiment days, 180 BHI snapshots, 4 campaigns, 2 events, 6 influencers, 9 SaaS-specific manual metrics
- **Pinnacle Media** (agency) — `commit da84b69`

### Phase 7 — Bug fixes ✅ (commit 8b80357, 2026-07-02)

`brands.industry` was added to the initial schema migration's `CREATE TABLE` after that migration had already run in production, so the column silently never existed there; PostgREST rejected any query referencing it, and `dashboard/layout.tsx` swallowed the error and treated every signed-in user as brand-less, bouncing them back to onboarding. Fixed with a migration to add the column, a query retry-without-`industry` fallback, and onboarding now only ever entered explicitly from signup/OAuth (never as a silent redirect from a query error).

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
| Industry model | `brand_type` on brands drives funnel/BHI signal routing, weight presets, and nav visibility — never hardcode FMCG-shaped assumptions | One codebase serves 7 verticals; see `docs/industry-fit-strategy.md` |
| Feature discovery | Every dashboard module ships with a 3–5 step tour (`data-tour` attributes + `TourSpotlight`) and a topbar "Show me around" trigger | First-visit onboarding without a human-written help doc per module |

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
| Retention risk page | `src/app/dashboard/retention/retention-client.tsx` |
| Retention risk API | `src/app/api/retention/risk/route.ts` |
| Advocacy + Promoters | `src/app/dashboard/advocacy/advocacy-client.tsx` |
| Referral redirect | `src/app/ref/[code]/route.ts` |
| CDP sync + profiles | `src/app/api/cdp/` |
| CDP page | `src/app/dashboard/cdp/cdp-client.tsx` |
| Loyalty engine | `src/app/dashboard/loyalty/loyalty-client.tsx` |
| Marketplace | `src/app/dashboard/marketplace/marketplace-client.tsx` |
| Budget pacing | `src/app/dashboard/budget/budget-client.tsx` |
| A/B Testing | `src/app/dashboard/experiments/experiments-client.tsx` |
| Creative Library | `src/app/dashboard/creative-library/creative-library-client.tsx` |
| Creative Fatigue Monitor | `src/app/dashboard/creative-fatigue/fatigue-client.tsx` |
| Voice Builder (Retune+Generate) | `src/app/dashboard/voice-builder/page.tsx` |
| Brand Voice Caption API | `src/app/api/ai/brand-voice/caption/route.ts` |
| OOH Geo Attribution Panel | `src/components/ooh/geo-attribution-panel.tsx` |
| OOH Geo Audiences API | `src/app/api/ooh/geo-audiences/route.ts` |
| Geo-Lift study page | `src/app/dashboard/geo-lift/page.tsx` |
| Field Intelligence | `src/app/dashboard/field-intelligence/field-intelligence-client.tsx` |
| MMM page | `src/app/dashboard/mmm/mmm-client.tsx` |
| Industry config (nav visibility, prompts, metrics per vertical) | `src/lib/industry-config.ts` |
| BHI weight presets by brand_type | `src/lib/bhi.ts` (`BRAND_TYPE_WEIGHTS`) |
| Trust Pillar card (fintech) | `src/components/brand-equity/trust-pillar-card.tsx` |
| Venue reputation panel (Google Maps) | `src/components/brand-equity/venue-reputation-panel.tsx` |
| First-party data ingestion | `src/app/api/first-party/[type]/route.ts` |
| Brand API keys (settings) | `src/app/api/brand/api-keys/route.ts`, `api-keys-section.tsx` |
| Dashboard widget system | `src/app/dashboard/dashboard-hero.tsx`, `template-picker.tsx`, `src/app/api/dashboard/prefs/route.ts` |
| Manual metric entry | `src/app/api/dashboard/metrics/route.ts` |
| Product tour definitions + spotlight | `src/components/tours/tour-definitions.ts`, `tour-spotlight.tsx`, `global-tour-button.tsx` |
| CMO Board Pack | `src/app/dashboard/reports/board-pack/page.tsx` |
