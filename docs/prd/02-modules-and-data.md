# BrandGauge: Product Requirements Document
## Document 2 of 5: Modules, Tools & Data Architecture

| Field | Value |
|---|---|
| **Product** | BrandGauge |
| **Document** | 2 of 5: Module specs with status, the tool suite, the data model, data-access rules |
| **Version** | 8.0 |
| **Owner** | Emmanuel Femi-Adejobi |
| **Status** | Live product |
| **Last updated** | 14 September 2026 |
| **Reads with** | Doc 1 (Foundations) · Doc 3 (Roadmap) · Doc 4 (Build Guide) · Doc 5 (Design System & Decisions) |

This document specifies what is inside each module and what state it is in, the collection
tool suite, and the data model. The status legend is defined in Doc 1: **Built**, **Inert**,
**Deferred**, **Dropped**.

Section C covers the twenty surfaces that exist and had no entry in the v6 module map.
Section E carries the data-access rules, which are requirements now rather than conventions,
because breaking them produced real cross-tenant bugs.

---

## A. Module specifications

### Module 5: Digital Intelligence Hub

**Purpose.** Centralise digital performance measurement; every metric connects to the funnel
and feeds the AI Command Layer.

**5.1 Social platform connections.**

| Platform | Mechanism | Status | Note |
|---|---|---|---|
| Instagram | Graph API, Business or Creator account | **Built** | Also the source of hashtag and tagged-media mentions |
| X | API v2, OAuth2 PKCE | **Built** | Direct mentions via the connected user token |
| Facebook | Pages API | **Inert** | Schema supports it; no connect flow driven end to end |
| TikTok | Business API | **Inert** | `TIKTOK_ADS_APP_ID`, `TIKTOK_ADS_SECRET` |
| LinkedIn | Company Page API | **Inert** | `LINKEDIN_ADS_CLIENT_ID`, `LINKEDIN_ADS_CLIENT_SECRET` |
| YouTube | Data API v3 | **Inert** | `youtube_api_configs` table and a brand monitor job exist; needs credentials |
| WhatsApp | Meta Cloud API v20.0 | **Inert** | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN` |

A **cross-platform unified metrics card** rolls these up: total reach, impressions, blended
engagement rate, net follower growth, virality score and competitor social share of voice.
**Built.**

The **content performance engine** is a sortable table with funnel-stage tagging, campaign
tagging, sentiment score and an AI diagnosis row. **Built.** The **content mix optimiser**
that detects content-type imbalance and maps it to a funnel gap is **Deferred**: the table
exists, the automatic imbalance diagnosis does not.

**5.2 Pre and post content intelligence.** The daily-use hook. Five scores (predicted
engagement, cultural resonance, tone match, message clarity, risk flag), risk flags with
offending text and a replacement, a verdict and a suggested rewrite. **Built**, as both a
page and an in-app widget, on `POST /api/ai/pre-post`.

Sub-features: the caption and copy predictor is **Built**. The press release and long-form
check, headline A/B intelligence, and the cross-platform adaptation engine are **Deferred**.
The brand voice consistency check is **Built** and draws on the voice builder (Section C).

**Beyond the v6 spec: a vision path.** An image can be attached and it is factored into all
five scores, adding visual hook strength, colour psychology, cultural visual cues, brand
aesthetic consistency, text-to-visual alignment and visual risk. The rewrite instruction
changes to improve the caption rather than propose a new image. v6 specified text only.

> **Correction to an earlier claim in this document's drafting, and a real gap.** The
> cultural calendar fit check is **Partly built**. It exists as its own feature against a
> campaign concept, and it is **not wired into the pre and post prompt**: that prompt
> currently states "No live events loaded yet" and asks the model to fall back on general
> calendar awareness. So the highest-traffic AI surface in the product is scoring cultural
> timing from the model's own knowledge rather than from `cultural_events`. Doc 3 carries the
> fix, and it is cheap: the context builder already assembles everything else.

> v6 specified an SMS variant in the cross-platform adaptation engine. **Dropped** with SMS.

**5.3 Paid media.** Metrics with formula, funnel stage and optimisation direction. Ad account
storage, drafts and creative pulls are **Built**. Connectors: Meta Ads **Built**; Google Ads
**Inert** (`GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`);
TikTok Ads, LinkedIn Ads and X Ads **Inert** on the variables above. A universal CSV import
fallback is **Built** through the manual metric path.

**5.4 Email intelligence.** Delivery, open, click-through, click-to-open, conversion,
unsubscribe, list growth, revenue per email. Connectors: Mailchimp and Brevo **Built**;
HubSpot **Inert** (`HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`). Klaviyo, ActiveCampaign and
SendGrid are **Deferred**.

**5.5 Search and discoverability.** GA4 is **Built** with OAuth, encrypted tokens and
automatic refresh. Share of search is **Inert** (`SERPAPI_KEY`). Google Search Console,
Semrush and Ahrefs are **Deferred**.

> The strategic note from v6 stands and is worth repeating: share of search is a leading
> indicator, moving six to twelve weeks ahead of awareness change. It is the highest-value
> **Inert** item in this document.

**5.6 App and product analytics.** App store and Play review ingestion is **Built** through
the review framework, with an app-store connector and a review sync job. A developer-health
surface covers technical-audience signal. Firebase, Mixpanel, Amplitude, Adjust and
AppsFlyer are **Deferred**.

---

### Module 6: Brand Equity Tracker

**6.1 Brand Health Index.** A single 0 to 100 composite over seven components. **Built.**

One scoring function computes it, and every surface calls the same input loader, so the
overview, the equity page, the AI answers and the nightly snapshot produce one number for a
brand. Zones: under 40 At Risk, 40 to 65 Building, 65 to 80 Healthy, 80 and above Leading.
Deltas against 7, 30 and 90 days. A **data coverage** bar reports what share of components
ran on real data, and missing components redistribute their weight rather than scoring zero.

Component weights branch on `brand_type` (Doc 1, Section 3.2) and remain adjustable per
brand.

> **A history note that matters for any chart of BHI over time.** A three-component version
> of this score (sentiment 40, share of voice 30, survey 30) once wrote the stored history
> while the pages computed the seven-component score live. It was removed on 2 September
> 2026. Snapshots it produced are marked `formula_version = 1` and **are not comparable**
> with later rows. Any trend that crosses that boundary must say so.

**6.2 Multi-channel share of voice.** Social, paid impression share, OOH, search, press and a
blended total weighted by media mix. **Built.**

**6.3 Excess share of voice engine.** `ESOV = SOV − market share`, with posture bands from
Growth Mode to Critical Decline. **Built.** The budget-to-target simulator is **Built** inside
the budget planning surface (Section C).

**6.4 Salience and category entry points.** Survey methodology, mental penetration rate and
mental market share, visualised as a bubble chart. **Built** as a survey-fed component.
The twelve pre-loaded Nigerian category entry point examples across fintech, FMCG and telecom
are **Deferred** as seeded content.

**6.5 Earned media value.** Per source type with user-set benchmarks and market defaults.
**Built.** The formula, in full:

```
EMV = (Total Impressions + Total Reach) × CPM_benchmark
    + Total Engagements × CPE_benchmark
```

Computed per source type: press, organic social by follower tier, influencer by platform and
engagement rate, event visual appearance, and broadcast mention. Benchmarks are set per
workspace in settings, with market defaults supplied.

**6.6 Brand perception score.** Eight dimensions (quality, trustworthiness, innovation,
value, cultural relevance, accessibility, reliability, emotional connection), each with a
survey question and a social signal, shown as a radar with competitor overlay. **Built.**

**6.7 Reputation and trust score.** Three-tier alerting. **Built**, and extended past the v6
spec with a volume-anomaly trigger: a brand's average score can stay flat while complaint
volume multiplies, and that is the pattern that goes viral. The volume trigger fires on a
z-score against the 30-day baseline, independently of any score change.

**6.8 Memorability and recall.** Aided and unaided recall tracked over time. **Built** via
surveys. A launch-marker feature lets a release or campaign be logged and the BHI, sentiment
and share of voice delta computed for the following 7 and 28 days. **Built**, and not in v6.

**6.9 Brand authority score.** Thought-leadership volume and quality, press source authority,
recognition signals, category search authority. **Partly built**: press authority and content
signals are **Built**, the composite score is **Deferred**.

---

### Module 7: OOH & Media Intelligence

**7.1 Site database.** Full per-site record including format, illumination, traffic,
operator, cost, campaign dates, cultural zone, photo and scan count. **Built.**

**7.2 Reach and impression model.** **Built**, with a geo-audience table behind the fit
score. The three formulas, in full:

```
Gross Impressions     = Average Daily Traffic × Campaign Days × Visibility Factor
Effective Impressions = Gross Impressions × Demographic Fit Score
CPM                   = Site Cost ÷ (Effective Impressions ÷ 1000)
```

`Visibility Factor` is a per-format constant between 0 and 1, set by the format table on the
site record. `Demographic Fit Score` is the overlap between a site's traffic demographic and
the brand's target audience, between 0 and 1, computed from `ooh_geo_audiences`.

**7.3 Cultural zone mapping.** Sites tagged by zone, rendered on a map with pins coloured by
return tier and zones as overlays. **Built.**

**7.4 OOH to digital uplift.** Campaign dates per city, branded search for the OOH city
against a matched control, correlation and an AI interpretation. **Built** as a job and a
chart, and **Inert** in practice until `SERPAPI_KEY` is set.

**7.5 Spend justification report.** Cost per effective impression per site, OOH against
digital cost per thousand, site-level ranking. **Built.**

**7.6 Media spend attribution.** Each media type mapped to a funnel-stage contribution,
rolled into a blended dashboard. **Built**, and superseded in rigour by marketing mix
modelling and geo-lift (Section C), which is the better answer to the same question.

> **Attribution decision, changed since v6.** OOH attribution is a branded vanity link plus
> UTM as the primary mechanism, with search uplift as corroboration. **QR is a secondary
> toggle, off by default.** v6 treated QR scanning as the primary path. See Doc 5, decision 4.
> Event attribution is ambassador-captured leads through the PWA.

---

### Module 8: Brand Sentiment Suite

**8.1 Social sentiment engine.** Classification runs on Claude with the full cultural context
block, chosen over traditional NLP because it handles code-switching, Pidgin, sarcasm and
context. **Built.**

The cultural interpretation reference is part of the prompt and is reproduced in Doc 3.

**Mention sources, and an important constraint v6 did not anticipate.** The free-tier sources
are X through `GET /2/users/:id/mentions` on the connected OAuth token, which returns direct
at-handle mentions only, and Instagram through hashtag search and tagged media, which needs a
connected Instagram Business account and is capped at thirty hashtag queries a week. **The
app-only bearer search endpoint is not used: it returns 402.** Any plan that assumes broad
social listening on a free tier is wrong, and the product is honest about it: a quiet
category and a blocked feed are distinguished rather than both reported as zero.

**8.2 Sentiment dashboard.** A daily index line chart with campaign and cultural-event
overlays and competitor lines, topic clusters with verbatim quotes, an emotion visualisation
and an alert feed. **Built.** A sentiment dispute path lets a misclassification be corrected
in product. **Built**, and not in v6.

**8.3 Audio transcription and analysis.** Upload, transcription with a language-specific
context hint, sentence-level sentiment, keyword extraction, theme clustering with quotes, an
executive summary and competitor mention extraction. **Built** as a pipeline
(`audio_files`, `transcriptions`) and **Inert** for transcription until an audio credential
is configured.

**8.4 Survey system.** Six templates, multi-language with per-question switching, analytics
with response count, completion rate, NPS breakdown, AI verbatim clusters and quality gating.
**Built**, plus survey panels and a dispatch job that v6 did not have.

**Delivery channels are fixed and this is a hard rule: email, in-app, WhatsApp and a
shareable link. No SMS. No USSD.**

> **Defect, open as of this version.** Two live code paths still send WhatsApp through
> Africa's Talking rather than the Meta Cloud API: the survey WhatsApp send route and the
> panel dispatch job. The decision (Doc 5, decision 3) is Meta Cloud only. This is code that
> should be migrated, not a rule to relax. Doc 3 carries it as open work.

**8.5 NPS and advocacy tracker.** Digital and offline NPS unified into one trend, promoter
archetype analysis, detractor diagnosis, a rolling chart with annotations. **Built.**
Respondent role cohorts (consumer, trade partner, retailer, developer, decision maker, end
user) split every NPS chart, which is what makes one NPS system work for both a distributor
and a SaaS tool. **Built**, and not in v6.

**8.6 Offline discourse monitor.** Field reports with outlets, trade partner metrics and a
field sales surface are **Built**. The agent network SMS pulse is **Dropped** with SMS. The
community leader perception module, tracking church, mosque, market association, youth group
and alumni network mentions, is **Deferred**.

---

### Module 9: Cultural Intelligence Engine

This is the module furthest from its v6 specification, and the gap is in collection rather
than in analysis.

**9.1 Cultural Resonance Score.** A 0 to 100 composite over five weighted dimensions:
cultural authenticity 25, language relevance 20, visual representation 20, symbol and value
suitability 20, community embeddedness 15. The table and the score exist
(`cultural_resonance_scores`). **Partly built**: the score computes where inputs exist, and
for most brands it computes as null, so its fifteen percent of the BHI redistributes. The
survey and creative-audit inputs that would populate it are specified and thin in practice.

**9.2 Cultural calendar.** `cultural_events` exists and the campaign fit check is **Built**.
The thirty-plus pre-loaded Nigerian and West African events are **Partly built**: the
mechanism is there, the full seeded set is **Deferred**.

**9.3 Audience analysis.** The three-dimensional profiler (demographic, psychographic,
behavioural) and the affinity map are **Deferred**. The customer data platform surface
(Section C) covers part of the same ground with first-party data instead of profiling.

**9.4 Cultural drift monitor.** A rolling score per segment with a severity scale and an
escalation. **Deferred**, and gated on 9.1 having real inputs. A drift monitor over a null
score reports nothing.

**9.5 Language intelligence.** The language gap report and opportunity calculator are
**Deferred**.

**9.6 Regional cultural variance.** Per-region scores as a choropleth. **Deferred** on the
same dependency.

**9.7 Activation suggestion engine.** The nine-section activation brief. **Deferred.** The
business case generator (Section C) is the built surface closest to it.

> **Read this before building module 9.** Five of its seven sub-features are deferred on one
> dependency: cultural resonance needs inputs. Building the drift monitor, the variance map or
> the activation engine first produces three surfaces that display null. The order is
> collection, then score, then everything that reads the score.

---

### Module 10: Event & Sponsorship ROI

| Sub-feature | Status |
|---|---|
| Event setup wizard, five sections, goes live on completion | **Built** |
| Ambassador PWA at `/ambassador/[token]`, no auth, tap buttons, lead sheet, offline-first with a queue and a pending-sync badge, per-ambassador session token and leaderboard | **Built** |
| Live event dashboard on Realtime | **Built** |
| Attendee intercept survey | **Built** (`event_intercept_responses`) |
| Post-event debrief as a structured field-intelligence form | **Built** |
| Visual brand mention detector: crawls event-hashtag posts, runs vision analysis for logo, colours, merch, booth and packaging, logs reach and sentiment, detects competitors | **Built** |
| Event ROI model and the automatic report | **Built** (`event_roi_reports`) |
| Sponsorship events as a first-class object | **Built**, not in v6 |
| Activation mechanic effectiveness scorer across events | **Deferred** |
| Event-to-digital correlation tracker | **Deferred** |

---

### Module 11: Influencer Intelligence

Creator discovery with a filterable directory, engagement and value estimates, language,
location and risk level: **Built**. Brand values alignment scoring from a creator's recent
public posts, returning a score, evidence points, alignment areas, risk areas and a
recommendation: **Built**. Cultural IQ scoring, distinct from engagement rate so that a
smaller creator with high cultural embedding can beat a larger one for trust goals:
**Built**. Campaign tracking with per-creator UTM and promo code, attributed through those
plus branded-search uplift: **Built** (`influencer_campaigns`, `influencer_posts`). Creator
risk scoring over competitor history, controversy detection and over-monetisation:
**Built**. YouTube creator deals: **Built**, not in v6.

Audience quality and inflated-follower detection: **Deferred**. The micro-creator community
network map that identifies non-traditional influence nodes such as community leaders,
religious influencers and market-union heads: **Deferred**, and the most distinctive idea in
the module, so it is worth keeping on the list rather than quietly losing.

The campaign brief form and the creator self-report form are **Deferred**.

---

### Module 12: Competitive Intelligence

A competitive scorecard against up to six competitors: **Built**. An excess share of voice
league table with posture badges: **Built**. A weekly briefing that generates each Monday and
delivers in-app and by email: **Built** (`weekly_briefings`). A competitive activity feed with
significance rating and pattern detection at three or more same-type activities in fourteen
days: **Built**. A competitor sighting map fed by a field report: **Built**
(`competitor_sightings`).

Data sources: public profile crawl **Built**; press and news **Built** through the press
crawl; app reviews **Built**; AI assistant mentions **Built** through the visibility tracker;
Meta Ad Library **Inert**; Google Trends **Inert** (`SERPAPI_KEY`); hiring signal as an
investment proxy **Deferred**; field sighting **Built**.

---

### Module 13: Creative Analysis

Pre-launch scoring across cultural resonance, brand consistency, message clarity, emotional
impact and call-to-action strength: **Built**. Cultural red flags in the flag, element,
reason, alternative format: **Built**. Funnel-stage suitability detection: **Built**. The
creative effectiveness score collected post-campaign by recall survey with a pre-launch
prediction: **Built**. The reception predictor with a predicted reaction distribution,
simulated audience voices in the audience's dialect with emotion tags, cultural tripwires and
demographic variance: **Built**. A creative library: **Built**, not in v6. Creative fatigue
detection: **Built**, not in v6.

The weekly visual identity monitor running vision over published posts and scoring palette,
logo, font, photography and talent consistency: **Deferred**. Competitor creative
intelligence from the Meta Ad Library: **Inert**. Video-specific scoring (thumbnail
prediction, hook strength, pacing, brand-visibility duration, subtitle quality, music
alignment) and audio-specific scoring: **Deferred**. The creative brief intelligence form:
**Deferred**.

---

### The AI Command Layer

**Built**, and the primary surface of the product rather than a feature on it.

A full-page chat with a source panel, plus a widget that persists across navigation. It
answers any brand question by aggregating connected sources and citing them, with a stated
confidence level based on data availability. Every question it cannot answer for lack of data
returns a collection recommendation: which tool, which module, what it would unlock.

Generated documents: business case **Built**; funnel leak diagnostic **Built**; competitive
briefing **Built**; monthly report **Built**; survey analysis **Built**; brand voice
extraction **Built**; brand inference from a website **Built**. Scheduled report delivery
**Built**. The full six-report automated suite from v6 is **Partly built**: four of the six
generate and deliver.

> **The v6 warning still earns its place.** The AI Command Layer is not a standalone feature,
> it is a function over data. With no modules feeding it, it is an empty chat box. The quality
> of every answer is bounded by the data supply beneath it. This is why the MVP could never
> have been "build the answer engine first."

**One implementation rule learned the hard way.** A model asked for JSON will sometimes wrap
it in a fence and occasionally prefix it with a sentence however firmly the prompt forbids
that. Parsing must take the outermost brace pair (`extractJson`), never `JSON.parse` on a
trimmed string, and the token budget must be large enough for the full structured response. A
bare catch around a naive parse makes the feature look broken with no way to find out why.

---

## A.1 The MVP Input Spine

Kept in this set because it remains the right way to think about what the answer engine needs,
and because it is the diagnostic to apply to any new vertical: a vertical without all three
layers produces hollow answers no matter how many modules sit on top.

| Spine layer | Draws from | Feeds | What it lets the AI answer | Status |
|---|---|---|---|---|
| **1. Owned performance** | Module 5 | `social_connections`, `social_posts`, `digital_performance_daily` | "How is our own content performing, by funnel stage?" Necessary and weak alone. | **Built** |
| **2. Public perception** | Module 8 | `mentions`, `sentiment_daily` | "What do people actually think of us, in their own language?" The first thing most brands here genuinely cannot see. | **Built** |
| **3. One direct signal** | Module 8 | `surveys`, `survey_responses` | "What do people say when we ask them directly, including those not posting?" This is what makes the answer cross digital and offline. | **Built** |

On top sit two synthesis features: the Brand Health Index and the AI Command Layer. Both
**Built**.

**The dependency that gates everything:** layer 2 depends on the cultural sentiment
capability reading local language correctly. If it is unreliable, layers 2 and 3 produce
confident and wrong perception data, and no number of modules above it can help. This is why
the build began with a validation test rather than a screen.

---

## B. Data collection tools

The design rule for every tool: filling the tool is the work, not work added on top.

| Code | Tool | Channel | Status | Note |
|---|---|---|---|---|
| E1 | Event setup wizard | Web form | **Built** | |
| E2 | Ambassador PWA | QR to mobile browser | **Built** | `/ambassador/[token]`, offline-first |
| E3 | Live event dashboard | Web | **Built** | Realtime |
| E4 | Attendee intercept survey | QR to mobile | **Built** | |
| E5 | Post-event debrief | Web form | **Built** | |
| E6 | Visual brand mention detector | Social crawl and vision | **Built** | |
| S1 | WhatsApp quick pulse | Meta Cloud API | **Inert** | Needs the three WhatsApp variables |
| S2 | Field audio capture | Mobile recorder | **Inert** | Pipeline built, transcription credential missing |
| S3 | Agent network pulse | SMS | **Dropped** | With SMS, Doc 5 decision 3 |
| S4 | Geo-tagged intercept survey | Mobile with GPS | **Deferred** | Surveys have no coordinate capture |
| S5 | Focus group upload | Web upload | **Built** | Same pipeline as S2 |
| D0-D | Pre and post intelligence widget | In-app panel | **Built** | The priority feature |
| D1 | UTM builder and campaign tagger | In-app | **Partly built** | UTM construction lives inside the OOH site form and the influencer tracker; there is no standalone builder |
| D2 | OOH vanity link generator | In-app | **Built** | `/go/[slug]`. QR is a secondary toggle, off by default |
| D2-B | OOH site logger | Mobile with GPS | **Built** | |
| D3 | Creative brief intelligence form | Web form | **Deferred** | |
| B1 | Quarterly brand health survey | Email, WhatsApp, link | **Built** | No SMS path |
| B2 | Always-on intercept widget | Embeddable | **Built** | Through the pixel and SDK surfaces |
| I1 | Influencer campaign brief | Web form | **Deferred** | |
| I2 | Creator self-report | Web form | **Deferred** | |
| CI | Competitor sighting report | Mobile with GPS | **Built** | |
| **PS** | **Public category scoreboard** | Public web, no auth | **Built** | New in v8. A stranger gets a real reading with nothing connected. Top of the lead funnel. |
| **REF** | **Referral codes and links** | Public web | **Built** | New in v8. `/ref/[code]` |
| **FSO** | **Field sales surface** | Token link | **Built** | New in v8. `/fso/[token]` |
| **PORT** | **Client portal** | Token link, read-only | **Built** | New in v8. `/portal/[token]` |

---

## C. Modules built since v6

Twenty surfaces with no v6 entry. Grouped by the question each answers rather than renumbered,
because the v6 module numbers have stopped being a useful index.

### C.1 Proving and planning spend

| Surface | What it answers | Status |
|---|---|---|
| Budget planning, line items and actuals | "What are we spending, against what plan, and what did it return?" | **Built** |
| Marketing mix modelling | "Which channel actually moved the number?" The rigorous version of module 7.6. | **Built** |
| Geo-lift studies | "Did the campaign cause the lift?" Matched-market testing. | **Built**, **Inert** without `SERPAPI_KEY` for the search arm |
| Media plan | "How should the next flight be allocated?" | **Built** |
| Board pack | "What do I put in front of the board this month?" | **Built** |
| Business case generator | "How do I justify this spend in writing?" Board-grade tier. | **Built** |
| A/B experiments | "Which version wins?" `ab_experiments`, `ab_variants`, `ab_events` | **Built** |

### C.2 Channels v6 did not cover

| Surface | Status | Note |
|---|---|---|
| PR and press | **Built** | `press_mentions`, a press crawl job, and a regulatory mention detector |
| Radio | **Built** | Stations and schedules, feeding awareness |
| TV | **Built** | Channels and schedules |
| Print | **Built** | Publications, placements and visits |
| YouTube | **Built** / **Inert** | Brand monitor and creator deals; needs API credentials |
| Marketplace | **Built** | Products, reviews and snapshots. Serves `brand_type: marketplace` |
| Loyalty | **Built** | Programmes, tiers, members, rewards, transactions. Serves stage 5 directly |
| Retention | **Built** | Cohort retention against the loyalty and purchase data |
| Advocacy | **Built** | Advocacy scores, promoters and referral events. Serves stage 6 directly |

### C.3 First-party data

| Surface | What it does | Status |
|---|---|---|
| Customer data platform | Accepts customer profiles and purchase events the brand already owns | **Built** |
| Pixel and SDK | First-party event capture from the brand's own site and app | **Built** |
| Commercial metrics | Sector-specific metric tables: fintech, SaaS, venue traffic, trade partner, ecommerce sales, developer health | **Built** |
| Manual and daily metrics | `metric_manual`, `metric_daily` for anything with no connector | **Built** |
| Sector benchmarks | Comparison against category norms | **Built** |
| Webhooks and API keys | Outbound webhooks and per-brand API keys | **Built** |

### C.4 Lead generation, new in v8

The public scoreboard reads a public Nigerian press feed for a category, computes reach, an
earned media value estimate and share, and shows a stranger a real reading with nothing
connected. It then asks for an email. Those leads land on a desk the assistant works from.

| Piece | Status | Note |
|---|---|---|
| Public scan and the scoreboard page | **Built** | The one open endpoint with no token in the whole product |
| Lead capture | **Built** | `leads` |
| The lead desk | **Built** | Scoped by the `is_lead_desk()` allowlist, not by workspace |
| Weekly scoreboard refresh | **Built** | Inngest |
| Lead alert email | **Inert** | `LEAD_ALERT_EMAIL` |

**Why this surface is a deliberate exception to two standing rules.** It is the only endpoint
with no token, because it reads a public news feed and touches no tenant row: there is no
caller to verify. It is guarded instead by an IP rate limit and a cache, both of which fail
open, because a Redis outage should degrade the free tool rather than return a 500. And its
tables are the only place row-level security does not scope to a workspace, because a lead
belongs to BrandGauge rather than to a customer. See Section E.3.

### C.5 Supporting surfaces

Methodology (how every number is computed, in product), tours (a first-visit product tour per
module), voice builder, connectors, settings, notifications, plan limits, usage events, and
`user_dashboard_prefs`. All **Built**.

**Product tours are a requirement, not a nicety.** Every dashboard module ships with a
first-visit tour and is reachable from the persistent topbar trigger. There are currently
tours for twenty-six surfaces. A new module without one is incomplete.

---

## D. Data model

### D.1 Scale, against plan, and where the schema now lives

| | v6 plan | v8 actual |
|---|---|---|
| Migrations | 1 initial schema | 85 |
| Tables | 32 | roughly 127 |

The v6 schema was written as one executable block to paste into a first migration. That was
the right call for a cold start and it is no longer how the schema changes.

**`supabase/migrations/**` is the schema. This document does not reproduce it.** That is a
deliberate change from v6, where the executable block in Part 2 was called the single most
important build artifact in the set. With 127 tables across 85 migrations, a copy in a
document is not a source of truth, it is a second version that goes stale silently and then
gets trusted. What this document carries instead is the part that a migration cannot state
for itself: the conventions every migration must satisfy, and the two access-control
functions in full, below.

The rule is **one migration per change**, timestamp-named `YYYYMMDDHHMMSS_short_name.sql` in
UTC so ordering is stable, written **before** the code that depends on it. Run
`supabase migration list` first to confirm only your migration is pending, then
`supabase db push`.

### D.2 The v6 core, and what happened to it

All 32 v6 tables exist, with three renames and one removal worth recording:

- `social_accounts` is `social_connections`.
- `content_performance` is `social_posts` plus `digital_performance_daily`.
- `creators` kept its name and gained `influencers` alongside it.
- `cultural_events` is global and reference-only, and still carries row-level security with
  an authenticated-read policy so the public anon key cannot write it.

### D.3 Conventions

Every tenant table carries `brand_id` and reaches the workspace through `brands.workspace_id`.
Every new table gets row-level security enabled and a workspace-scoped policy **in the same
migration**. The standard shape:

```sql
alter table X enable row level security;

create policy "workspace members" on X for all
  using (is_workspace_member((select workspace_id from brands where id = brand_id)));
```

or the equivalent `exists (select 1 from brands b where b.id = X.brand_id and
is_workspace_member(b.workspace_id))` form used in the initial schema.

Reference-only tables that hold no tenant data still get row-level security on, with an
authenticated-read policy.

Connector and OAuth tokens are stored **encrypted** with AES-256-GCM. Never in plaintext.
`TOKEN_ENCRYPTION_KEY` is required in production.

Phone numbers are E.164 and live only on `whatsapp_contacts` under row-level security. The
send log stores a SHA-256 hash, never the number.

### D.4 The second security scope, new in v8

There are now **two** row-level security patterns, and the second one is deliberate.

| Pattern | Scopes to | Used by |
|---|---|---|
| `is_workspace_member(workspace_id)` | The signed-in user's workspace | Every tenant table |
| `is_lead_desk()` | An allowlist of BrandGauge staff | `public_scans`, `leads`, `lead_desk_admins` |

Both functions in full, as they exist:

```sql
create or replace function is_workspace_member(ws uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function is_lead_desk()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.lead_desk_admins a where a.user_id = auth.uid());
$$;
```

A lead belongs to BrandGauge, not to a customer workspace, so scoping it to a workspace would
be meaningless. These three tables are written by the service role only. This is the single
exception; a third pattern needs a decision, not a migration.

> **Known gap, visible in the two definitions above.** `is_lead_desk()` pins
> `search_path = public`. `is_workspace_member()` does not, and it is a `security definer`
> function that every tenant policy in the product depends on. It should be brought in line.
> Doc 3 carries it as open work with an owner.

---

## E. Data access: the rules that came from real bugs

This section is a requirement, not a convention. On 11 July 2026 a class of cross-tenant
vulnerability was found and fixed across three routes. The rules below are what prevents it
recurring.

### E.1 Two clients, and which one is the default

| Client | Runs as | Use for |
|---|---|---|
| `createClient()` | The signed-in user, scoped automatically by row-level security | **The default.** Anything a logged-in user does to their own data. |
| `createServiceClient()` | The service role, bypassing row-level security entirely | Webhooks, scheduled and background jobs, public token-gated endpoints, cross-tenant admin work. Nothing else. |

### E.2 The hard rule

**When the service client is used in a request a user triggered, the caller's ownership of
the row must be verified manually.** A service-client query filtered only by an id taken from
the request body or params is a cross-tenant hole. That is exactly the bug that was found on
the brand delete, the event visual scan and the survey analysis routes.

The safe pattern: fetch or verify the row through the row-level-security client first, or add
an explicit `.eq('brand_id', <active brand>)`, and only then do service-role work.

### E.3 Public endpoints

`/survey/[id]`, `/ambassador/[token]`, `/go/[slug]`, `/portal/[token]`, `/fso/[token]` and
`/ref/[code]` post or redirect through a service-role route that **validates the token or slug
first**. Anon row-level security is never opened on those tables.

The public scoreboard is the one exception and the reason is in Section C.4: no caller to
verify, no tenant row touched, guarded by a rate limit and a cache that both fail open.

### E.4 The active brand

Always resolve the current brand through `getActiveBrandId()` or `getActiveBrand()`. **Never**
`.from('brands').select(...).limit(1).single()`: that ignores the active-brand cookie and
silently breaks every multi-brand workspace, which includes every agency customer. v6 had no
concept of an active brand because it had no multi-brand flow yet.

### E.5 Webhooks

Every webhook verifies its signature before doing any work. Paystack uses HMAC SHA-512;
Flutterwave a timing-safe secret compare; Meta and WhatsApp Cloud HMAC SHA-256, timing-safe;
Stripe `constructEvent`. A provider that does not sign is authenticated with a shared secret
in the callback URL or header, and fails closed when the variable is unset.

Admin and seed endpoints are gated by `ADMIN_SECRET`, sent as `x-seed-secret`, failing closed
if unset. No secret is ever hardcoded in source.

### E.6 OAuth state

Connect routes generate a random `state`, store it in Redis with a short time to live or in an
httpOnly cookie, and the callback verifies then consumes it. State validation is never
skipped. GA4 uses a `ga4_oauth_state` cookie, httpOnly, sameSite lax, ten minutes.

---

## F. The sentiment data model

Worth its own section because it is the most-read table in the product and its shape is not
obvious.

Social mentions come from every connected platform and each row carries a `platform` field.
`sentiment_daily` stores per-day aggregates in **two layers**:

- **`social_score`**, a volume-weighted blend across platforms:
  `Σ(platform_score × platform_volume) ÷ total_volume`.
- **`platform_breakdown`**, a JSONB object of per-platform detail:
  `{ "twitter": { volume, score, positive_pct, neutral_pct, negative_pct }, "instagram": {…} }`.

**Adding a platform means pushing a new key into the JSONB. There is no migration.** That is
the point of the design.

The BHI reads **only** `social_score`. The sentiment dashboard reads `platform_breakdown` for
per-platform pills and a split panel. Anything that needs one number reads the first layer;
anything that needs detail reads the second.

---

## G. Model routing

The tier-to-model mapping lives in `src/lib/ai/client.ts` and **that file is the single
source of truth**. Model IDs are not written anywhere else, and deliberately not in this
document, because they drift. v6 hardcoded them into three documents and all three went stale
within four months.

Route by tier, never by model name:

| Tier | For |
|---|---|
| `cultural` | Sentiment, the pre and post widget, anything touching Pidgin, Yoruba, Igbo or Hausa |
| `structural` | Reports, competitive briefings, funnel diagnosis, general answers |
| `chat` | The AI Command Layer |
| `boardGrade` | Executive business cases |

Call through `callAi({ tier, system, messages, maxTokens?, temperature? })`. Routes that call
AI set `runtime = 'nodejs'` and a sensible `maxDuration`. The Layer 1 brand context is cached.

Three standing rules: all AI calls are server-side and the keys never reach the client; our
own generation is Anthropic only; and **no model name is ever displayed in any UI**. The AI
visibility tracker is the single exception to the second rule, because there the external
models are the thing being measured rather than the thing generating our output.

---

## Next actions (Doc 2)

| # | Action | Owner | By | Blocking |
|---|---|---|---|---|
| 1 | **Migrate the two Africa's Talking WhatsApp paths to the Meta Cloud API** (Section 8.4): the survey WhatsApp send route and the panel dispatch job. This is a live contradiction between locked decision 3 and shipped code. | Claude Code | 30 Sep 2026 | Yes, it violates a locked decision |
| 2 | **Pin `search_path` on `is_workspace_member()`** (Section D.4). A `security definer` function that every tenant policy depends on. | Claude Code | 30 Sep 2026 | No, but cheap and security-relevant |
| 3 | **Set `SERPAPI_KEY`.** The highest-value single variable in this document: it turns on share of search, the OOH uplift correlation, the geo-lift search arm and the Google Trends competitive source at once. Four Inert items become Built with one credential. | Emmanuel | 30 Sep 2026 | Yes, gates four features |
| 4 | **Decide on module 9** (Section A, module 9). Fund the cultural resonance collection or lower the component weight. Five deferred sub-features sit behind that one dependency. | Emmanuel | 15 Oct 2026 | Yes |
| 5 | **Finish D1 as a real surface or drop it** (Section B). UTM construction exists twice today, in two unrelated forms, which is how two different tagging conventions get into one dataset. | Claude Code | 15 Oct 2026 | No |
| 6 | **Sweep the remaining AI routes onto `extractJson`** so no route parses a trimmed string. Seven routes are outstanding. | Claude Code | 15 Oct 2026 | No |
| 7 | **Set the three WhatsApp variables** to move S1 and the whole WhatsApp module from Inert to Built. | Emmanuel | No date set. Gated on Meta business verification, which is outside our control. | No |

*End of Document 2 of 5.*
