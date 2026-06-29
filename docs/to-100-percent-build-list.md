# What We Build to Reach 100% — Full Industry Coverage

Getting every vertical to 100% requires three layers of work: shared platform work (done once, benefits all), per-vertical connectors (new data sources), and first-party data ingestion (data the brand owns that we need to accept). Below is the complete list with nothing omitted.

---

## Layer 1 — Shared platform work
*Do these once. Every industry benefits.*

### 1.1 Brand-type routing
- Add `brand_type` enum to `brands` table: `fmcg | fintech | venue | b2b_saas | marketplace | beverage_alcohol | b2b_distribution`
- Branch the funnel signal arrays in `page.tsx` by brand type (same engine, different signals)
- Adjust BHI component weights per brand type (e.g. trust matters more for fintech; offline reach matters more for FMCG)
- Add brand-type selector to the onboarding and settings flows

### 1.2 Review/reputation framework
- New table: `review_platform_snapshots` (brand_id, platform, rating, review_count, review_velocity, review_text jsonb, period)
- Platform enum: `play_store | app_store | google_maps | tripadvisor | g2 | capterra | product_hunt | jumia | konga`
- This is the single table all review connectors write to
- Feeds Preference stage (rating signal) and Advocacy stage (velocity signal) for all brand types

### 1.3 Aspect-level review sentiment
- Run the Claude Haiku cultural model over review text in `review_platform_snapshots`
- Extract aspect tags per review: food, service, ambiance, value, reliability, feature_quality, support, price_fairness
- Store in `review_aspect_sentiment` table
- Powers the "worth it" and product-quality dimensions in Preference for all industries

### 1.4 Complaint-surge / volume-anomaly detector
- Extend the existing alert system with a second trigger: negative mention *volume* z-score (not score delta)
- A brand's averaged score can stay flat while complaint volume 5×'s — this is the pattern that goes viral
- Alert fires at 2σ above the 30-day baseline for negative mention count
- Appears in the sentiment alert feed alongside existing score-change alerts

### 1.5 Audience-type dimension on mentions
- Add `audience_type` to `mentions` table: `consumer | creator | developer | retailer | media | general`
- Populated by the sentiment classifier (keywords, account bio parsing, source domain)
- Allows every industry to split their sentiment by who is talking — creators vs buyers (Selar), developers vs consumers (Paystack), retailers vs end-users (OmniRetail)

### 1.6 Feature-launch / event markers
- Let users log a product release, campaign launch, or key event with a date and label
- Auto-calculate BHI, sentiment, and SOV delta in the 7 and 28 days after the marker
- Surfaces in brand equity and sentiment pages as annotated timeline events
- Critical for fintech (feature release → brand lift) and venues (big night → awareness spike)

### 1.7 B2B NPS cohort
- Add `respondent_role` to `nps_records` and survey responses: `consumer | trade_partner | retailer | developer | decision_maker | end_user`
- All NPS charts split by cohort
- Makes a single NPS system work for both Guinness (trade partner vs consumer) and a SaaS tool (decision-maker vs operator)

---

## Layer 2 — Per-vertical connectors
*New external data sources. One connector per row.*

| Connector | Table it populates | Who needs it | Notes |
|---|---|---|---|
| Google Maps Places API | `review_platform_snapshots` | Venues, restaurants, hotels | **API key already exists** in `src/lib/ooh/places-demographics.ts`. This is the fastest connector to ship. |
| App Store Connect API | `review_platform_snapshots` | Fintech, SaaS | Apple requires app ownership verification |
| Google Play Developer API | `review_platform_snapshots` | Fintech, SaaS | Needs service account |
| G2 API | `review_platform_snapshots` | B2B SaaS | G2 has a partner API |
| Capterra / Software Advice | `review_platform_snapshots` | B2B SaaS | Gartner Digital Markets API |
| Product Hunt API | `review_platform_snapshots` | SaaS, creator tools | Public GraphQL API |
| GitHub API | `developer_health_snapshots` | API/dev tools (Paystack, Flutterwave) | Stars, forks, open issue count, contributor count |
| npm registry API | `developer_health_snapshots` | Developer tools | Weekly download count |
| Stack Overflow API | `developer_health_snapshots` | Developer tools | Question count, answer rate for tagged libraries |
| LinkedIn API (SOV) | `sov_snapshots` | B2B SaaS, distribution | LinkedIn SOV as a separate breakdown key |
| TripAdvisor API | `review_platform_snapshots` | Hospitality, venues | For brands with international visitors |

New table for developer tools: **`developer_health_snapshots`** (brand_id, platform, stars, downloads_weekly, open_issues, contributors, period).

---

## Layer 3 — Per-vertical signal and schema additions
*What each industry needs beyond the shared work above.*

---

### Fintech (Paystack, OPay, Cowrywise, Piggyvest, Kuda)
**Target: 60% → 100%**

**New signals for the funnel:**

*Awareness (add):*
- App install rank (Play Store / App Store category position)
- Branded search volume trend (if Google Search Console connected)

*Action (replace FMCG signals with):*
- Completed KYC / verified signups (30d count) — from first-party data feed
- First transaction completed (30d count) — from first-party data feed
- First save / first transfer (for savings apps) — from first-party data feed
- App store conversion (install → registration) — from App Store / Play Store API

*Loyalty (replace with):*
- Active users (Monthly Active Users trend) — from first-party data feed
- AUM / balance growth trend — from first-party data feed
- Funding frequency (avg days between deposits) — from first-party data feed
- Dormancy rate (users with no activity in 30d) — from first-party data feed

**New BHI pillar:**
- **Trust score** = weighted composite of: app store rating trend (40%) + regulatory-standing flag (30%) + security-incident absence (20%) + uptime/reliability sentiment (10%)
- Replaces or supplements the current perception pillar for fintech brand types

**New schema:**
- `regulatory_mentions` table: brand_id, source_entity (CBN/SEC/NDIC/CAC), sentiment, mention_type (licence_grant | sanction | investigation | positive_mention | neutral), date
- `fintech_metrics` table: brand_id, period, mau, aum, avg_balance, funding_frequency, dormancy_rate — brands connect their own data via secure API key or CSV upload

**New module:**
- **Regulatory Watch** panel in brand equity: lists recent CBN/SEC mentions with sentiment and links, weighted into the Trust pillar

---

### Creator Economy (Selar, Mainstack creator side)
**Target: 50% → 100%**

**New signals for the funnel:**

*Awareness (add):*
- Active storefront / creator page count (total published pages trending month-over-month)
- Platform GMV trend (total value transacted through the platform — from first-party data)

*Consideration (add):*
- Creator trial-to-first-sale conversion rate — from first-party data
- New creator signups (30d) as a consideration signal (creators are discovering the platform)

*Action (replace with):*
- New paid storefronts activated (30d)
- First sale by new creator (30d count)
- GMV processed this month

*Loyalty (replace with):*
- Creator retention rate (active last month / active 2 months ago)
- Creator churn rate (migrated away or inactive 60d+)
- Repeat-buyer rate on platform (same buyer purchases from multiple creators — platform stickiness)

*Advocacy (add):*
- Creator UGC about the platform ("built with Selar" posts, "Mainstack page" tags)
- Creator-to-creator referrals (a creator recommending the platform to another creator)

**New schema:**
- `platform_metrics` table: brand_id, period, active_creators, new_creators, churned_creators, gmv, storefronts_live, avg_revenue_per_creator — populated by first-party data feed
- `audience_type` on `mentions` (already in Layer 1)

---

### B2B SaaS (developer tools, HRM platforms, API products)
**Target: 45% → 100%**

**New signals for the funnel:**

*Action (replace with):*
- Trial signups (30d) — from first-party data
- Trial-to-paid conversions (30d) — from first-party data
- Seats / API integrations activated (30d) — from first-party data

*Loyalty (replace with):*
- Renewal rate (customers up for renewal who renewed) — from first-party data
- Net Revenue Retention / NRR (expansion revenue / churn / contraction) — from first-party data
- Customer churn rate — from first-party data

*Advocacy (add):*
- G2 / Capterra reviews posted (30d velocity) — from review connector
- G2 category rank — from review connector
- Case studies published or shared (30d) — manual entry or content tool

**New schema:**
- `saas_metrics` table: brand_id, period, trial_signups, trial_converted, seats, mrr, nrr, renewal_rate, churn_rate — first-party data feed
- `developer_health_snapshots` (already in Layer 2)

**NPS:** Decision-maker vs end-user cohort split (already in Layer 1, section 1.7)

---

### Hospitality & Venues (Praia Lagos, Hard Rock Cafe, restaurants)
**Target: 55% → 100%**

**New signals for the funnel:**

*Action (replace with):*
- Covers / guests seated this period — from `venue_traffic` table (manual or POS import)
- Occupancy rate (covers / capacity %) — from `venue_traffic`
- Reservations made (30d) — from reservation system integration (Eat.ing, OpenTable, manual)

*Loyalty (replace with):*
- Repeat-visit rate (guests who visited 2+ times in 90d) — from POS/reservation data
- Visit frequency (average days between visits for returning guests)
- Members / table-card holders (active count + redemption rate)

*Advocacy (replace referral codes with):*
- Google Maps review velocity (new reviews per week, rating trend) — from Maps connector
- Geotagged/venue-tagged UGC (Instagram posts with the venue tagged or geolocated) — from visual mentions + social listening
- Organic celebrity/influencer sightings (unpaid mentions from high-follower accounts at the venue)

*Preference (add):*
- Google Maps star rating (from connector — this is the #1 hospitality signal)
- Aspect sentiment scores: food, service, ambiance, value, music/vibe — from review aspect analysis

**New schema:**
- `venue_traffic` table: brand_id, date, covers, capacity, reservation_count, walk_in_count, occasion_type (birthday | corporate | casual | special_event), source
- `venue_reputation_snapshots` (via `review_platform_snapshots` with platform=`google_maps`)

**New module:**
- **Venue Reputation Panel** in brand equity: Google Maps star trend, recent reviews, aspect breakdown (service / food / ambiance / value), week-over-week review velocity

---

### FMCG / Beverages (Guinness, Indomie, Tolaram, PZ Cussons)
**Target: 70% → 100%**

**Highest-leverage change (data already exists):**

Wire Field Intelligence into the BHI and funnel immediately:
- `Weighted Distribution Availability` = average `product_available` rate across outlets → Awareness signal (scale: 100%)
- `Stock-Out Rate` = outlets with `stock_level = 'out'` ÷ total → Action signal (inverted, scale: 100%)
- `POSM Presence Rate` = outlets with POSM → Consideration signal
- `Observed Price vs RRP` = deviation from recommended retail price → Preference signal

This alone moves FMCG from 70% to ~85% with zero new data collection.

**New signals:**

*Compliance layer (required for alcohol brands before pitching Guinness/NB/Heineken):*
- `age_compliance_flag` on TV/OOH campaigns: marks whether the creative ran in APCON-compliant time slots
- Influencer/mention audience age filtering: flag signals where audience is materially under-18
- NAFDAC-compliant reach calculation (strips non-compliant impressions from awareness score)

*New sentiment types:*
- **Price-mention sentiment**: mentions that reference price, affordability, or value ("Indomie don cost") — separate signal from general sentiment
- **Competitive substitution mentions**: "I switched from X to Y because..." — feeds competitive intelligence and consideration
- **Occasion sentiment**: mentions tagged to calendar occasions (Ember months, Detty December, Eid, TGIF) — seasonal brand health view

**New signals — On/Off-trade:**
- Add `channel` to `purchase_events`, `ecommerce_sales`, `loyalty_transactions`: `on_trade | off_trade | modern_trade | general_trade | e-commerce`
- Feeds channel-split view in the action stage and a new Distribution & Trade panel

**New schema:**
- `sponsorship_events` table: brand_id, event_name, type (sports | music | cultural), start_date, end_date, estimated_reach, actual_reach, brand_lift_pct
- Feeds a Sponsorship Brand Lift signal in Awareness + new Sponsorships panel

---

### B2B Distribution (OmniRetail, Tolaram trade arm)
**Target: 50% → 100%**

**New signals for the funnel:**

*Action (replace consumer signals with):*
- Orders placed by retailer/distributor partners (30d) — from first-party order data
- Order fill rate (orders fully fulfilled on time ÷ total) — key brand-promise signal for a distribution brand
- New retail partner onboarding (30d count)

*Loyalty (replace consumer signals with):*
- Retailer reorder rate (partners who placed 2+ orders in 90d)
- Distributor churn rate (partners who stopped ordering)
- Avg days between reorders (reorder frequency)

**New schema:**
- `trade_partner_metrics` table: brand_id, period, active_partners, new_partners, churned_partners, total_orders, fill_rate, avg_order_value
- `nps_records.respondent_role` = `retailer | distributor` (already in Layer 1 section 1.7)

---

## What requires first-party data from the brand

Some signals cannot be derived from public data or external APIs — the brand must connect their own systems. BrandPulse builds the ingestion layer; the brand enables the connection.

| Signal | Industry | How the brand connects it |
|---|---|---|
| MAU / DAU | Fintech, SaaS | Secure API key or CSV upload |
| AUM / balance data | Fintech (savings/investment) | Secure API key — aggregated, not individual balances |
| KYC completions, first transactions | Fintech | Secure API key from their backend |
| Trial signups, trial-to-paid, NRR | B2B SaaS | CRM/billing tool integration (HubSpot, Stripe/Paystack) |
| Covers / reservations | Hospitality | POS integration or manual weekly entry |
| GMV, active creators, creator churn | Creator platforms | Secure API key from their platform |
| Order fill rate, retailer reorder rate | Distribution | ERP/order management integration |
| Retail channel split | FMCG | POS integration or distributor data feed |

For all of these, we build a **First-Party Data Connector** pattern: brand generates an API key in BrandPulse settings, their backend (or a CSV export) posts to `/api/first-party/[metric-type]`, we validate and store in the appropriate table. No direct database access required from the brand's side.

---

## Total build scope

| Layer | Items | Estimated effort |
|---|---|---|
| Layer 1 — Shared platform | 7 items | 3–4 weeks |
| Layer 2 — Connectors | 11 connectors | 4–5 weeks (parallel with Layer 1) |
| Layer 3 — Fintech | 8 signal additions + 2 tables + 1 module | 2–3 weeks |
| Layer 3 — Creator/SaaS | 6 signal additions + 2 tables | 2–3 weeks |
| Layer 3 — Hospitality | 5 signal additions + 2 tables + 1 module | 2 weeks |
| Layer 3 — FMCG | Wire Field Intel + compliance + new signals | 2–3 weeks |
| Layer 3 — Distribution | 5 signal additions + 1 table | 1–2 weeks |
| First-party connector framework | 1 generic pattern, multiple schemas | 1–2 weeks |
| **Total (parallelized)** | | **~10–12 weeks, 2 engineers** |

---

## What 100% actually means

100% does not mean we track everything. It means:
- For every signal in a stage, we either have real data or it's clearly labelled "connect your data" with a CTA to set it up
- No stage returns null because the brand type is wrong
- The funnel score for a fintech is built from fintech signals; the funnel score for a venue is built from venue signals
- A brand can onboard and see a meaningful score within their first 48 hours, regardless of industry

A Piggyvest that has connected their MAU and first-party transaction data should see a loyalty score built from AUM growth and funding frequency — not from `total_orders >= 2`. That is what 100% means.
