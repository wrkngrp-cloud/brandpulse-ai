# BrandPulse AI — Industry Fit Strategy
*Four-vertical audit: Fintech · Creator/SaaS · Hospitality/Venues · FMCG/Trade*

---

## The headline finding

BrandPulse is not broken for other industries — it is mis-labelled and partially wired. The scoring engine (`computeStageComposite`, weight redistribution, null-safe composites) is the right architecture for every industry. The funnel shape (6 stages from awareness to advocacy) is correct for every industry. What's wrong is that roughly half the signals in the Action, Loyalty, and Advocacy stages are named and scaled for an FMCG brand selling physical units. A digital bank, a nightclub, or a SaaS platform sees those signals, gets null/zero, and the funnel looks broken — even though the brand is healthy.

Two fixes unlock most of it. Everything else is additive.

---

## What's genuinely strong (don't touch this)

These apply cleanly to every industry and are real competitive advantages:

- **Multi-source sentiment engine** — per-platform breakdown, topic clusters, emotion wheel, alert detection. Universal.
- **AI Visibility Tracker** — brand presence in ChatGPT/Gemini/Perplexity. Actually *more* valuable for SaaS and fintech than FMCG, since people increasingly discover brands through AI answers.
- **Cultural resonance scoring** — this is a genuine moat in the Nigerian/African market. Every vertical benefits from it.
- **Weight-redistributing composites** — if a signal has no data, it's excluded and its weight flows to what does. This means partial data always produces a meaningful score. Right architecture for a multi-industry platform.
- **Competitive intelligence module** — brand-agnostic. Works for beer vs beer, fintech vs fintech, club vs club.
- **Field Intelligence module** — the FMCG audit confirmed this already exists and captures outlet-level availability, stock levels, pricing, and POSM. This is real distribution data that even big FMCG tools charge a premium for. It just isn't connected to the BHI or funnel yet.
- **Brand mention + SOV tracking** — universal. Works for every brand type.
- **The existing `brand.category` field** — the hook we need for industry-aware signal routing already exists.

---

## Fix 1: The `brand_type` flag (unlocks everything else)

Every single vertical audit independently concluded the same thing: the signals need to be configurable per brand type. The architecture already supports it — `computeStageComposite` just needs a different signal array depending on what the brand is.

**Add `brand_type` to the `brands` table:**

| Value | Who |
|---|---|
| `fmcg` | Jara Foods, Indomie, PZ Cussons, consumer goods |
| `fintech` | Paystack, OPay, Cowrywise, Piggyvest, Kuda |
| `venue` | Praia Lagos, Hard Rock Cafe, restaurants, hotels |
| `b2b_saas` | BrandPulse itself, Mainstack (B2B side), HRM tools |
| `marketplace` | Selar, Mainstack (creator side), Jumia sellers |
| `beverage_alcohol` | Guinness, Heineken, NB — regulated category, inherits `fmcg` + compliance layer |
| `b2b_distribution` | OmniRetail, Tolaram trade arm |

The funnel page reads `brand.brand_type` and loads the appropriate signal set. Same composites engine, different signal arrays. BHI component weights also adjust per type (trust matters more for fintech; offline reach matters more for FMCG).

---

## Fix 2: Review/rating connectors (fills the single biggest gap across all verticals)

Every industry has a primary "reputation on a platform we don't own" signal that we're not reading:

| Brand type | Missing connector | Source |
|---|---|---|
| Fintech | App Store / Play Store rating + review velocity | App Store Connect API, Google Play API |
| Venue / Hospitality | Google Maps rating + review count | Google Maps Places API *(key already exists in `src/lib/ooh/places-demographics.ts`)* |
| B2B SaaS | G2 / Capterra / Product Hunt rating + category rank | G2 API, Capterra API, PH API |
| FMCG | Jumia/Konga review text sentiment | Already have `marketplace_snapshots`; need text sentiment |
| All | Generic review text → aspect sentiment | Run Haiku cultural model over review text |

New table: **`review_platform_snapshots`** (brand_id, platform, rating, review_count, review_velocity, period, metadata jsonb). One table, all platforms. Feed into Preference stage (rating) and Advocacy stage (velocity).

---

## Industry-by-industry gap summary

### Fintech (Paystack, OPay, Cowrywise, Piggyvest, Kuda)

**What works:** Sentiment, SOV, competitive, AI Visibility, NPS, press mentions, referral tracking, advocacy score.

**What's wrong:**
- No Trust pillar in the BHI. For a bank, trust IS the brand. It's currently a sub-signal inside sentiment.
- Awareness stage over-weights OOH/TV/radio (42% of base weights) — most fintechs spend almost nothing there.
- Action stage = purchase events + e-commerce units. A payment app has no "units." First transaction, completed KYC, first save/transfer are the real Action signals.
- Loyalty stage uses `total_orders >= 2` for repeat rate. A savings app's loyalty is AUM growth and funding frequency, not order count.

**Critical gaps:**
1. **Complaint-surge detector** — fintech Twitter in Nigeria is brutal. A single viral "they locked my funds" thread can 5× negative mention *volume* while the averaged sentiment score barely moves. We alert on score delta, not volume anomaly.
2. **Regulatory mention tracking** — a CBN licence grant or sanction moves brand trust more than any campaign. Not tracked at all.
3. **App store rating trend** — most trusted proxy for fintech product quality. Absent.
4. **Portfolio/AUM-based churn** — current churn model is brand-level mood, not balance decline or dormancy.
5. **Feature-launch markers** — Piggyvest's brand is tied to product releases. No way to attribute BHI lift to a specific launch.

---

### Creator Economy (Selar, Mainstack) & B2B SaaS

**What works:** Social sentiment, influencer reach, brand mentions, cultural resonance, AI Visibility, referral tracking, advocacy score, perception surveys.

**What's wrong:**
- Action stage = purchases, e-commerce, OOH visit-throughs. For Selar, "action" is a creator publishing their store. For a SaaS, it's a paid subscription or first API call.
- Loyalty = repeat orders + loyalty earns. SaaS loyalty is renewal rate and expansion revenue (NRR). Neither exists in the schema.
- NPS is a single consumer pool. B2B requires decision-maker NPS (buyer/founder) vs end-user NPS (operator) as separate series.
- Advocacy doesn't count G2/Capterra reviews or case studies — the primary B2B advocacy currency.

**Critical gaps:**
1. **Creator community health** — for Mainstack/Selar, their creator community IS the brand. No signal for creator adoption, creator churn (switching to Gumroad), or creator-vs-buyer sentiment separation.
2. **Review-platform reputation** (G2, Capterra, Product Hunt) — B2B brand is built here more than on Instagram.
3. **Renewal rate + NRR** — the two pillars of SaaS loyalty. Completely absent.
4. **Developer community signals** (GitHub stars, npm, Stack Overflow) — essential for Paystack/Flutterwave dev tools.
5. **LinkedIn SOV** — for B2B brands, LinkedIn matters more than Twitter/Instagram. Schema supports a `linkedin` breakdown key already; just not weighted in SOV.

---

### Hospitality & Venues (Praia Lagos, Hard Rock Cafe, restaurants, nightlife)

**What works:** Social sentiment, SOV, influencer reach, cultural resonance, events module, visual mentions, NPS, press coverage.

**What's wrong:**
- Marketplace rating tracks product SKUs flagged `is_own_product`. The star-rating infrastructure exists — it points at the wrong thing.
- Customer repeat rate uses `total_orders >= 2`. Venues need repeat *visits*, not repeat purchases.
- Action stage = purchases, e-commerce, SDK conversions. None of these exist for a restaurant. Action for a venue is a reservation or walk-in.
- Advocacy = referral codes. Venue advocacy is Instagram tags, Google reviews, and "you HAVE to come here" WhatsApp messages.

**Critical gaps:**
1. **Google Maps rating** — the #1 decision driver for "where do I go tonight?" is completely absent. The Google Maps API key already exists in the codebase (`src/lib/ooh/places-demographics.ts`). This is the fastest win in this entire document.
2. **Covers / occupancy** — number of seated guests vs capacity. The hospitality equivalent of units sold.
3. **Aspect-level review sentiment** — "jollof amazing / service slow / drinks overpriced." Brand-level sentiment can't capture this.
4. **Event brand-lift wiring** — venues are event-driven. The pre/post module exists but isn't connected to specific programmed nights.
5. **Celebrity/influencer organic sightings** — when Davido shows up at Praia, it's different from a paid post. Not tracked.

---

### FMCG / Beverage / Trade (Guinness, Indomie/Tolaram, OmniRetail)

**What works:** This is the strongest vertical. Social sentiment, SOV, OOH/TV/radio, events, cultural resonance, marketplace listings, Field Intelligence (distribution coverage, stock levels, observed pricing — already built!), loyalty/retention scaffolding.

**The biggest finding:** Field Intelligence data already exists and is not wired into the BHI or funnel. This is free value sitting idle. A brand's weighted distribution availability is arguably the most important FMCG signal there is — and we collect it but don't score it.

**What's wrong:**
- Distribution data lives in a silo, disconnected from brand health scores.
- TV GRP signals are unflagged for APCON/NAFDAC compliance. For alcohol brands, some tracked reach may be from restricted activity (under-18 targeting, watershed violations).
- All sales data is channel-blind. A Guinness bar pour and a supermarket six-pack are the same row — no on-trade vs off-trade split.
- NPS is B2C only. For OmniRetail, retailer NPS is the only NPS that matters.

**Critical gaps:**
1. **Wire Field Intelligence into BHI + funnel** — distribution availability % and stock-out rate should be Awareness and Action signals. The data already exists.
2. **Age-gating + regulatory compliance layer** — mandatory before pitching any alcohol brand. Sentiment and influencer signals for alcohol must be filtered for adult audiences.
3. **On-trade vs off-trade split** — channel dimension on `purchase_events`/`ecommerce_sales`.
4. **B2B/trade-partner NPS cohort** — separate retailer satisfaction from consumer NPS.
5. **Price-mention sentiment** — "Indomie don cost too much" is a specific brand signal. Distinct from observed shelf price (which we already track).
6. **Occasion/seasonality signals** — Ember months, Detty December, Eid, TGIF. Beer and noodle brands live by occasions.
7. **Sponsorship brand lift** — Guinness sponsors EPL viewing. No signal for sponsorship awareness lift.

---

## The prioritized build backlog

Ranked by: cross-vertical impact × speed of delivery.

### Tier 1 — Do these first (each unlocks a whole vertical)

| # | What | Impact | Why now |
|---|---|---|---|
| 1 | **`brand_type` field + signal routing in funnel** | All verticals | One schema change + branched signal arrays. The architecture already supports it. |
| 2 | **Wire Field Intelligence into BHI + funnel** | FMCG/Trade | Data already collected. Just needs a query added to the funnel and a distribution signal in `computeStageComposite`. |
| 3 | **Venue reputation connector** (Google Maps) | Hospitality | API key already in the codebase. Fastest new connector to ship. |
| 4 | **Complaint-surge detector** (volume anomaly, not score delta) | Fintech | Extends existing alert system. Single new metric — negative mention volume z-score. |
| 5 | **App store rating connector** (Play Store / App Store) | Fintech | New table, daily pull. Feeds Trust pillar + Preference stage. |

### Tier 2 — Next sprint

| # | What | Impact |
|---|---|---|
| 6 | **Trust pillar in BHI** for fintech/venue brand types | Fintech, Venue |
| 7 | **Aspect-level review sentiment** (food/service/ambiance/value for venues; feature quality for apps) | All |
| 8 | **Regulatory mention tagging** (CBN/SEC/NAFDAC/APCON as named entities with compliance flag) | Fintech, Alcohol |
| 9 | **`audience_type` on mentions** (creator / buyer / developer / general) | Creator economy |
| 10 | **B2B/trade NPS cohort** (retailer, distributor, developer as separate respondent types) | FMCG trade, SaaS |

### Tier 3 — After beta

| # | What | Impact |
|---|---|---|
| 11 | Review-platform connector (G2/Capterra/Product Hunt) | B2B SaaS |
| 12 | Developer community connector (GitHub, npm, Stack Overflow) | API/dev-tool brands |
| 13 | Renewal rate + NRR in loyalty stage for SaaS | B2B SaaS |
| 14 | Age + regulatory compliance layer for alcohol | Alcohol/Beverages |
| 15 | On-trade vs off-trade channel split on purchase/sales events | Beverage, FMCG |
| 16 | Occasion/seasonality overlay (Ember months, Detty December, Eid) | FMCG, Beverage |
| 17 | Sponsorship brand-lift signal | Beverage |
| 18 | LinkedIn SOV weighting in competitive/consideration | B2B |
| 19 | Feature-launch markers (tie BHI lift to product releases) | Fintech, SaaS |
| 20 | Celebrity/organic influencer sighting capture | Venue |

---

## What NOT to do

- Do not split the product into separate "BrandPulse for Fintech" and "BrandPulse for FMCG" SKUs. One platform, configurable by brand type.
- Do not remove OOH/TV/radio signals. Some fintechs (OPay) and venues (Hard Rock) do run mass media. Let them contribute when data exists; the weight redistributor handles null gracefully.
- Do not rebuild the scoring engine. `computeStageComposite` and `computeAwarenessComposite` are correctly designed. The only change is the signal *arrays* fed into them.
- Do not add every gap signal at once. Tier 1 (5 items) is the minimum viable multi-industry platform. Everything else is expansion.

---

## One-sentence summary per company

| Company | Status today | Blocker |
|---|---|---|
| **Paystack / OPay / PalmPay** | 60% fit | No Trust pillar, no app-store ratings, Action stage is wrong |
| **Cowrywise / Piggyvest** | 55% fit | Loyalty stage measures orders not AUM; no complaint-surge detection |
| **Kuda / Moniepoint** | 55% fit | Same as above + regulatory mention tracking missing |
| **Mainstack / Selar** | 50% fit | Creator community invisible; Action/Loyalty stages are FMCG-only |
| **Paystack (dev tools)** | 45% fit | No developer community signals; G2/Capterra absent |
| **Praia Lagos / Hard Rock** | 55% fit | Google Maps rating absent; Action/Loyalty stages completely wrong |
| **Guinness / NB / Heineken** | 70% fit | Age compliance layer missing; Field Intel data not wired in |
| **Indomie / Tolaram** | 70% fit | Field Intel silo; price-mention sentiment missing; no trade NPS |
| **OmniRetail** | 50% fit | B2B NPS absent; fill rate/retailer churn not modelled |
| **Jara Foods (demo)** | 85% fit | Already our best-optimized brand; Field Intel silo is main gap |
