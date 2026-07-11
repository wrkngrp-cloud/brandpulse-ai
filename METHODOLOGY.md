# BrandGauge — Detailed Methodology

> Internal reference document. Every score, metric, index, and AI output in BrandGauge is defined here with exact formulas, data sources, calibration rationale, and known limitations. Use this document to review, challenge, and refine our measurement approach.

---

## 1. Brand Health Index (BHI)

### Purpose
A single composite score (0–100) summarising overall brand health from live data signals. Sits on the main dashboard as the primary KPI gauge.

### Two modes

**Dashboard widget (3-component)**

| Component | Weight | Source |
|---|---|---|
| Social Sentiment | 40% | `sentiment_daily.social_score` — 14-day rolling average |
| Share of Voice | 30% | `sov_snapshots.social_sov` — most recent snapshot |
| Survey Score | 30% | Average NPS score × 10 from `survey_responses` |

Formula:
```
BHI = (sentiment × 0.40 + sov × 0.30 + survey × 0.30)
```

Missing components: weights are renormalised to 100% across only the available components. A brand with no surveys yet gets BHI = (sentiment × 0.571 + sov × 0.429). This means the score always reflects real data — never a zero-padded estimate.

**Brand Equity Tracker (7-component)**

| Component | Weight | Source |
|---|---|---|
| Awareness | 20% | Social SOV % |
| Salience | 15% | Aided awareness rate from Perception Audit surveys |
| Sentiment | 20% | 14-day avg `sentiment_daily.social_score` |
| Perception | 15% | Avg of 8 brand dimension ratings from survey Q2–Q9 |
| Cultural Resonance | 15% | Avg `cultural_score` from `pre_post_analyses` |
| Blended SOV | 10% | `sov_snapshots.social_sov` |
| EMV | 5% | Earned Media Value, normalised 0–100 |

Same renormalisation rule applies when components are null.

### Zone thresholds

| Zone | Range | Interpretation |
|---|---|---|
| At Risk | 0–39 | Significant brand challenges; urgent intervention needed |
| Building | 40–64 | Positive momentum; measurable gaps remain |
| Healthy | 65–79 | Strong fundamentals; optimise for growth |
| Leading | 80–100 | Above-market brand equity |

### Rationale
The 40/30/30 split is adapted from the Millward Brown BrandZ framework. Sentiment is weighted highest (40%) because organic social conversation is the highest-velocity signal available without purchase data, and in West African markets, word-of-mouth via social is disproportionately influential on purchase decisions relative to advertising recall. The 7-component full BHI aligns with the GfK Brand Health Tracking model used commercially across Sub-Saharan Africa.

### Known limitations
- SOV is sourced from connected social handles and tracked competitor keywords only; it does not capture search, display, or offline SOV.
- Survey Score requires a minimum of 3 responses before being included.
- Cultural Resonance is null until Pre-Post Intelligence analyses have been run at least once.

---

## 2. Social Sentiment Intelligence

### Purpose
Measure the emotional tone of all brand-related social conversation across connected platforms.

### Data sources
- **X (Twitter):** `GET /2/users/:id/mentions` using connected OAuth token. Captures direct `@handle` mentions. Free tier; app-only bearer token search is not used (paid).
- **Instagram:** `GET /{ig-user-id}/ig_hashtags + /recent_media` (hashtag search, 30 per week, free) and `GET /{ig-user-id}/tags` (tagged media). Requires a connected Instagram Business account.

### Blended sentiment score
When data arrives from multiple platforms, the blended score uses volume-weighted averaging:

```
blended_score = Σ(platform_score × platform_volume) / total_volume
```

This prevents a low-volume platform from having disproportionate influence. If Instagram has 500 mentions and X has 50, Instagram contributes 91% of the blended score.

Platform-level scores are stored in `sentiment_daily.platform_breakdown` JSONB. The top-level `social_score` column holds the blended value.

### Sentiment classification
Each mention is classified as positive, neutral, or negative using **Claude Haiku 4.5** (the cultural AI tier).

**Why Haiku, not a generic NLP model:**
Standard English-language sentiment models trained on US/UK data misclassify approximately 30–40% of Nigerian social content because:
1. Nigerian Pidgin English uses words that appear negative in standard English but are positive culturally ("e don die" = very good; "the thing don mad" = excellent).
2. Nigerian slang has a fast lifecycle. Terms rotate in and out of positive/negative usage within 6–18 months.
3. Religious expressions, festival references, and localised praise idioms are typically misread as neutral or negative.

The cultural classification layer provides a prompt that explicitly contextualises Pidgin, Yoruba code-switching, Igbo expressions, and Hausa digital vernacular.

### Emotion detection (Plutchik model)
Eight emotions per Plutchik's Wheel of Emotions:
- Joy, Trust, Anticipation (positive brand associations)
- Surprise (ambiguous; can signal viral moments or crises)
- Fear, Sadness, Disgust, Anger (risk signals)

Each mention is assigned a dominant emotion. The Emotion Wheel displays the distribution as a donut chart. The Emotion Resonance bar measures (Joy + Trust + Anticipation) / total as a purchase-intent proxy.

### Automated alerts

| Alert type | Trigger condition | Severity |
|---|---|---|
| Sentiment Crash | Daily delta ≤ −20 points | Critical |
| Sentiment Crash | Daily delta ≤ −10 points | Warning |
| Spike Watch | Daily delta ≥ +20 points | Watch |
| Sustained Negativity | >60% negative mentions for 3+ consecutive days | Warning |

### Topic Clusters
On demand, Claude Haiku analyses recent mention text and groups content into 3–5 thematic clusters with representative verbatim quotes. This runs as a one-time call (not continuous) so the brand team can explore what specific conversations are driving the sentiment reading.

---

## 3. Share of Voice (SOV)

### Formula
```
Social SOV = (Brand Mentions / (Brand Mentions + ΣCompetitor Mentions)) × 100
```

Where competitor mentions are sourced from the competitor handle and keyword list configured by the user under Settings — Competitors.

### Storage
Stored as `sov_snapshots.social_sov` (percentage, 0–100). Snapshots are taken each time the social crawl runs. The most recent snapshot is used for the BHI and Funnel calculations.

### Limitations
- Covers social mentions only. Does not include search, display, OOH, or broadcast SOV.
- Accuracy depends on the completeness of the competitor keyword list.
- Competitor handles must be manually configured; auto-discovery is not yet implemented.

---

## 4. Brand Funnel (6 stages)

### Purpose
Map where in the purchase decision journey audiences are converting, and surface drop-off points.

### Stage calculations

**Stage 1 — Awareness**
```
score = sov_snapshots.social_sov (direct, already 0–100)
```

**Stage 2 — Consideration**
```
avg_engagement_rate = avg(social_posts.engagement_rate) over last 30 days
score = MIN(avg_engagement_rate × 10, 100)
```
Calibration: A 10% average engagement rate on Nigerian Instagram is exceptional and scores 100. A 5% rate scores 50. This is deliberately generous because Nigerian engagement benchmarks are higher than global averages (Nigerian social media users have higher organic interaction rates, partly due to comment culture and giveaway mechanics).

**Stage 3 — Preference**
```
score = avg(sentiment_daily.social_score) over last 14 days
```
Already 0–100. No transformation needed.

**Stage 4 — Action**
```
lead_component = MIN((leads / total_interactions) × 100 × 0.60, 60)
ooh_component  = MIN(total_ooh_visits / 200, 40)
score          = MIN(lead_component + ooh_component, 100)
```
Calibration: 8,000 OOH monthly visits = 40 points (the maximum OOH contribution). 100% event lead capture rate = 60 points. The 60/40 split reflects that direct conversion intent (a lead) is a stronger signal than a passive visit.

**Stage 5 — Loyalty**
```
raw_nps = ((promoters - detractors) / total) × 100
score   = (raw_nps / 2) + 50
```
Rescales NPS from its native −100 to +100 range to 0–100 for funnel consistency. An NPS of 0 maps to a Loyalty score of 50. An NPS of +60 maps to 80. An NPS of −40 maps to 30.

Requires minimum 3 NPS-type responses to display.

**Stage 6 — Advocacy**
```
share_rate = total_shares / total_engagements (last 30 days)
score      = MIN(share_rate × 500, 100)
```
A 20% share rate (1 in 5 engagements results in a share) scores 100. This is calibrated against Nigerian social sharing behaviour, where retweet and share rates tend to be higher than Western markets.

### Drop-off colour coding

| Drop-off | Colour | Interpretation |
|---|---|---|
| ≤15% | Green | Healthy stage transition |
| 16–30% | Amber | Moderate bottleneck; worth investigating |
| >30% | Red | Significant conversion barrier |

---

## 5. Net Promoter Score (NPS)

### Standard formula
```
NPS = ((Promoters − Detractors) / Total Respondents) × 100
```
- Promoters: respondents scoring 9–10
- Passives: respondents scoring 7–8
- Detractors: respondents scoring 0–6
- Range: −100 to +100

Minimum 3 responses required to display.

### Nigerian category benchmarks (approximate)
| Category | Typical NPS range |
|---|---|
| FMCG / Consumer goods | 30–55 |
| Financial services (banks) | 20–40 |
| Fintech / Digital banking | 40–65 |
| Telco | 5–25 |
| E-commerce | 25–50 |
| QSR / Food service | 30–60 |

These are directional, not guaranteed. NPS is more meaningful as a trend direction indicator than as an absolute cross-category comparison.

### 12-week trend
BrandGauge displays a 12-week rolling NPS trend. The trend direction is computed by comparing the most recent 4 weeks against the prior 4 weeks. "Rising," "Falling," and "Stable" are assigned based on whether the difference exceeds ±5 NPS points.

---

## 6. Pre-Post Content Intelligence

### Purpose
Score brand content before publication and compare against post-campaign sentiment shifts.

### Five pre-publication dimensions

| Dimension | What it measures |
|---|---|
| Cultural Resonance | Does the content connect with Nigerian cultural context, idioms, and seasonal moments? |
| Brand Safety | Does it carry reputational, regulatory, or social risk? |
| Clarity | Is the message clear to the target audience? |
| Engagement Potential | Is it likely to drive interaction (comments, shares, reactions)? |
| CTA Effectiveness | Is the call to action visible, compelling, and specific? |

Each scored 0–100 by Claude Haiku 4.5 with explicit Nigerian/West African cultural calibration.

### Cultural calibration layer
The system prompt passed to Claude includes:
- Explicit guidance on Pidgin English interpretation
- Yoruba code-switching patterns
- Awareness of Nigerian slang lifecycle
- Festival and religious calendar context
- Regional sensitivity (Lagos vs Abuja vs Port Harcourt audience differences)

This calibration is applied consistently across all cultural AI tasks.

### Image and video analysis
When a visual is uploaded alongside text:
- **Images**: Converted to base64 JPEG and included in the AI vision call.
- **Videos**: First frame is extracted client-side using the HTML5 Canvas API (no server-side processing, no ffmpeg dependency, compatible with serverless deployment). The extracted JPEG frame is then analysed alongside the script.

**Why first frame?** The first 2–3 seconds determine whether a viewer stops scrolling. The hook quality is the strongest predictor of video completion rate on Instagram Reels and TikTok in the Nigerian market.

### Post-campaign comparison
BrandGauge computes the delta between the pre-publication score baseline and the post-period sentiment average. This is stored for trend analysis and feeds the Cultural Resonance Score.

---

## 7. Cultural Resonance Score (CRS)

### Formula
```
CRS = avg(cultural_score from pre_post_analyses)
```

Requires minimum 3 analyses. Displayed on the Cultural Intelligence page.

### Drift detection
```
recent_avg = avg(cultural_score, last 7 days)
baseline   = avg(cultural_score, prior 23 days)
drift      = recent_avg - baseline
```
A drift of more than 10 points triggers the drift badge (positive or negative).

### Emotion resonance ratio
```
emotion_resonance = (joy_count + trust_count + anticipation_count) / total_emotion_classifications
```
These three emotions are the strongest purchase-intent predictors in Nigerian consumer research. A high emotion resonance ratio alongside a high CRS indicates content that is both culturally appropriate and emotionally activating.

### Cultural Calendar
10 hardcoded Nigerian/West African cultural moments in 2026 are surfaced 45 days in advance:
- Sallah (Eid al-Fitr), Eid al-Adha, Ramadan preparation
- Valentine's Day Nigeria (culturally distinct from Western equivalent)
- Children's Day (27 May), Workers' Day (1 May), Independence Day (1 October)
- Christmas / Boxing Day season
- Detty December (the uniquely Nigerian entertainment season running Dec 15–Jan 5)

Brands producing culturally relevant content around these moments consistently outperform category averages on engagement and brand recall in BrandGauge pre-post analysis data.

---

## 8. Brand Equity Tracker

### ESOV Engine
```
ESOV = Share of Voice % − Market Share %
```
Market Share % is user-entered because purchase data is rarely available to brand teams directly. The user inputs their best estimate; ESOV is then calculated against the live SOV reading.

**Posture bands:**
| ESOV | Posture | Implication |
|---|---|---|
| > +5% | Growth Mode | Strong future market share growth predicted |
| 0 to +5% | Mild Growth | Marginal outvestment; modest growth expected |
| 0% | Parity | Holding share; not growing |
| 0 to −5% | Decline Risk | Underinvesting; share loss likely within 6–12 months |
| < −5% | Critical Decline | Significant underinvestment; urgent reallocation needed |

Rationale: The Les Binet and Peter Field ESOV-to-growth relationship, published in "The Long and the Short of It" and validated across multiple IPA Effectiveness Databank studies, holds that each percentage point of positive ESOV translates to approximately 0.5% of annual market share growth. This relationship was validated in emerging market contexts by Kantar in their 2019 BrandZ Africa study.

### Budget-to-ESOV Simulator
```
current_sov_per_naira = current_SOV% / current_annual_spend
target_SOV%           = market_share + target_ESOV
additional_SOV_needed = target_SOV% - current_SOV%
additional_spend      = additional_SOV_needed / current_sov_per_naira
```
Output is directional. It assumes linear scaling of SOV with spend, which is a simplification (diminishing returns apply at high spend levels). Designed to anchor budget conversations, not replace media planning.

### Perception Radar
Eight brand dimensions rated in Brand Perception Audit surveys, displayed as a Recharts RadarChart:
1. Quality
2. Trust
3. Innovation
4. Value for Money
5. Cultural Relevance
6. Accessibility
7. Reliability
8. Emotional Connection

Each dimension is scored 1–5 in surveys and normalised to 0–100 for the radar display.

### Earned Media Value (EMV)
EMV is calculated using a cost-per-impression benchmark (CPM proxy):
```
EMV = total_organic_impressions × (platform_CPM / 1000)
```
Where platform CPMs are internally benchmarked against Nigerian social advertising rates. Normalised to 0–100 for the BHI component using a log scale (because EMV distributions are heavily right-skewed — a single viral post can generate 10× the EMV of a typical month).

---

## 9. Influencer Intelligence

### Cultural IQ (0–100)
Measures how culturally resonant the influencer is for Nigerian audiences within the brand's industry context.

Assessment factors:
- Language and tone: Is their content style natural for Nigerian audiences? (Pidgin, slang, cultural references)
- Content-audience fit: Does their audience demographic match the brand's target segments?
- Platform behaviour: Are their engagement patterns consistent with authentic Nigerian creator behaviour (not inflated by pods or giveaways)?
- Category relevance: Is their niche adjacent to the brand's category?

**Score bands:**
- 70–100: Strong cultural fit — high likelihood of authentic engagement
- 50–69: Moderate fit — some cultural alignment gaps
- 0–49: Poor fit — misaligned audience or cultural tone

### Risk Score (0–100, where 0 = safe)
Assesses brand safety exposure:
- Content history: Has the creator posted content that could embarrass the brand?
- Controversy footprint: Any prior controversies relevant to the brand's category or values?
- Audience alignment: Is the audience composition (age, location, interests) consistent with the brand?

Risk is always evaluated within the brand's specific industry context. A risk factor relevant to a food brand (e.g. "audience follows for cooking content, not relevant to brand") may be completely irrelevant to a fintech or fashion brand.

**Score bands:**
- 0–30: Low risk — proceed
- 31–60: Medium risk — review specific flags before committing
- 61–100: High risk — detailed vetting recommended before partnership

### Brand Fit Score (0–100)
Composite of audience overlap (50%) and value alignment (50%). Returns one of three verdicts:
- Strong Fit (score ≥ 70)
- Potential Fit (score 45–69)
- Poor Fit (score < 45)

---

## 10. Creative Analysis

### A/B Comparison — five dimensions

| Dimension | What is scored |
|---|---|
| Engagement Potential | Likelihood of generating comments, shares, reactions on the target platform |
| Cultural Resonance | How well the creative connects with Nigerian cultural context |
| Tone Appropriateness | Whether the brand voice, language register, and emotional tone are suitable for the brand and platform |
| Clarity | How clearly the intended message comes through |
| Risk | Reputational, regulatory, or sensitivity risk |

Each dimension: 0–100. One creative must score higher than the other — the AI is instructed to differentiate, not return tied scores.

**With images/video:** The base64 frame is passed to Claude Sonnet 4.6 as a vision input alongside the text. Claude evaluates both the visual and the copy together — not the copy alone.

**Without images:** Falls back to text-only Sonnet 4.6 analysis.

### Identity Consistency Score
Analyses up to 3 recent brand posts simultaneously:
```
consistency_score = AI assessment of tone, visual language, and message coherence across all submitted posts (0–100)
```
Returns: strengths (what is consistent), drift warnings (where content deviates from the brand's established voice), and specific adjustments.

### Video Creative Scoring

| Dimension | What is scored |
|---|---|
| Hook Score | Does the first frame stop the scroll? Visual interest, intrigue, or immediate relevance in the first impression |
| Visual Score | Overall visual quality, branding clarity, composition, and production value |
| CTA Visibility | How clear, prominent, and actionable the call to action is |
| Sound-Off Score | How well the video communicates with sound muted — through text overlays, captions, and visual storytelling |

**Sound-off calibration:** Research from Meta Nigeria and TikTok Africa indicates that 40–60% of video on Nigerian social platforms is watched without sound, driven by data cost awareness, public viewing environments, and mobile battery management. Sound-off score is therefore weighted as a significant performance indicator in the BrandGauge scoring model.

**Overall score:** Average of the four dimensions.

---

## 11. OOH Intelligence

### Primary attribution: vanity links
Each OOH placement is assigned a unique vanity URL (`APP_URL/go/{vanity_slug}`). When a consumer visits the URL, BrandGauge:
1. Logs the visit with timestamp, referrer, and device type to `ooh_visits`
2. Attributes the visit to the specific `ooh_site` record
3. Increments the `visits` counter on the site

This is one-to-one deterministic attribution with no modelling assumptions.

### Secondary corroboration: search uplift (Pearson correlation)
```
r = Pearson correlation coefficient between:
    x = weekly OOH billboard visit counts
    y = weekly Google branded search volume (via Google Trends, brand keyword)
```
Interpretation:
- r ≥ 0.6: Strong evidence that OOH is driving branded search behaviour
- 0.3–0.59: Moderate positive relationship; other factors likely co-contributing
- < 0.3: Weak or no detectable relationship

Requires SERPAPI_KEY environment variable to pull Google Trends data. Without it, correlation is null and the system notes the configuration gap.

### GeoLift studies
```
correlation = Pearson(treatment_city_signal, control_city_signal)
```
Where `signal` is typically sentiment score or vanity link visits. A positive correlation indicates that both cities are moving together (not isolating OOH impact). A negative or near-zero correlation between treatment and control suggests the treatment city's signal change is not explained by broader market movements, increasing confidence that OOH drove the difference.

---

## 12. Radio Intelligence

### Metrics tracked
- Spots Planned vs Spots Aired (delivery rate = aired / planned)
- Cost per Spot (net cost / aired spots)
- Total Spend per station and daypart
- Estimated reach per spot (sourced from BrandGauge station database)

### Nigerian daypart standards
| Daypart | Hours (Lagos time) |
|---|---|
| Morning Drive | 06:00–10:00 |
| Daytime | 10:00–15:00 |
| Afternoon Drive | 15:00–19:00 |
| Evening | 19:00–22:00 |
| Late Night | 22:00–06:00 |

### AI analysis output
Four sections generated by Claude Sonnet 4.6:
1. **Daypart Efficiency Ranking** — cost-per-listener-impression by daypart, ranked best to worst
2. **Delivery Alerts** — stations with <85% delivery rate against plan
3. **Budget Reallocation** — which dayparts and stations to shift budget toward based on efficiency data
4. **Key Recommendation** — single most impactful action

Station database covers: Beat FM, Cool FM, Wazobia FM, Naija FM, Inspiration FM, Smooth FM, Classic FM (Lagos), Brilla FM, Raypower FM, and regional stations across Abuja, Port Harcourt, Kano, Ibadan, and other major markets.

---

## 13. TV Intelligence

### Core metrics

**Gross Rating Points (GRP)**
```
GRP = Reach % × Average Frequency
```
Total audience delivery. A campaign with 40% reach and an average of 3 exposures delivers 120 GRPs. GRP is the universal TV buying currency.

**Cost Per Rating Point (CPRP)**
```
CPRP = Total Spend / GRPs delivered
```
Lower CPRP = more efficient delivery. Used to compare efficiency across channels and dayparts.

**Cost Per Thousand (CPT)**
```
CPT = (Total Spend / Total Impressions) × 1000
```
The spend required to reach 1,000 members of the target audience.

### AI analysis output
Four sections generated by Claude Sonnet 4.6:
1. **Programme Performance Ranking** — programmes ranked by GRP delivery efficiency
2. **GRP Delivery Alerts** — programmes underdelivering against planned GRPs
3. **Prime Time vs Fringe Analysis** — efficiency comparison between premium and off-peak inventory
4. **Key Recommendation** — single prioritised action

Channel coverage: NTA, AIT, Channels TV, TVC, Arise TV, Africa Magic (DSTV), SuperSport, CNN Africa, Cartoon Network, E! Entertainment, regional state TV stations.

---

## 14. Print Intelligence

### Readership calculation
```
Readership = Circulation × Pass-Along Multiplier × Insertions
```

Pass-along multipliers by publication type (BrandGauge database, sourced from APCON-registered readership studies):
| Publication type | Typical multiplier |
|---|---|
| Mass daily (Punch, Vanguard, Sun) | 3.5–4.5× |
| Business daily (BusinessDay, Guardian Business) | 1.8–2.5× |
| Weekly magazine (TW Magazine, Genevieve) | 2.5–4.0× |
| Trade publication | 1.5–2.0× |

### QR attribution
Each placement auto-generates a unique vanity slug. When a reader scans the QR code:
1. Visit is logged to `qr_visits` and attributed to the `print_placement`
2. `qr_scan_count` is incremented on the placement record

**Nigerian benchmark:** Average QR scan rate for Nigerian print placements is approximately 0.3% of estimated readership. Placements exceeding this are flagged as top performers by the AI analysis layer.

### Cost Per Thousand (CPT)
```
CPT = (Net Cost / Estimated Readership) × 1000
```
Publications are ranked by CPT in the AI analysis output.

### AI analysis output (Claude Sonnet 4.6)
1. **Publication Reach Efficiency** — publications ranked by CPT
2. **QR Attribution Analysis** — scan rates vs Nigerian 0.3% benchmark
3. **Position and Size Insights** — which positions (front page, back page, ROP) and sizes delivered best cost-per-reader
4. **Key Recommendation** — single prioritised action

---

## 15. Competitive Intelligence

### Weekly AI Briefing
Every Monday at 08:00 Lagos time (Africa/Lagos TZ), an Inngest cron function runs for each brand:
1. Pulls the past week's competitor sightings from `competitor_sightings`
2. Pulls SOV movement from `sov_snapshots`
3. Pulls sentiment delta from `sentiment_daily`
4. Generates a structured briefing using Claude Sonnet 4.6
5. Stores the briefing in `weekly_briefings`
6. Sends an email via Resend to the configured brand contact

### ESOV League
All tracked competitors are assigned SOV readings from social mentions. ESOV League table:
```
ESOV = SOV% − estimated_market_share%
```
Market share is either user-entered or estimated by the AI using publicly available category data. The league table ranks all brands including your own ("YOU" badge) so the positioning is immediately visible.

### Sightings feed
Campaign sightings are logged manually by the team across six categories:
- Billboard / OOH
- Event / Activation
- Digital (social, display, search)
- Print
- TV
- Radio

Sightings include location, estimated spend tier (low/medium/high), and notes. They feed directly into the weekly AI briefing.

### Scorecard
Side-by-side comparison of your brand vs one selected competitor across:
- SOV%
- Sentiment score
- Content volume (posts per week)
- Market position (user-entered or AI-estimated)

---

## 16. Survey Intelligence

### Six standard templates
| Template | Questions | Duration | Primary use |
|---|---|---|---|
| Awareness Intercept | 2 | ~15 seconds | Quick spontaneous awareness check |
| Quick Pulse | 3 | ~45 seconds | Fast brand health pulse |
| Awareness Check | 5 | ~90 seconds | Aided + unaided awareness measurement |
| Post-Event | 8 | ~2 minutes | Event impact and lead quality assessment |
| Brand Perception Audit | 12 | ~3 minutes | Full brand equity measurement (feeds Brand Equity Tracker) |
| Post-Purchase NPS | 5 | ~60 seconds | NPS + purchase driver capture |

### Distribution
Surveys are distributed via:
- WhatsApp share link (shareable URL with brand name pre-filled)
- Email batch send (Resend, maximum 50 emails per batch to avoid spam triggers)
- Shareable link (copy-to-clipboard for any channel)

No SMS or USSD distribution (cost and delivery complexity exceed value at current scale).

### AI analysis
Survey responses are analysed by Claude Haiku (for sentiment-type clustering) and Claude Sonnet (for structured recommendation output). Analysis covers:
- Awareness gap identification
- Perception strength and weakness mapping
- NPS root cause diagnosis (detractor verbatim clustering)
- 90-day action recommendations grounded in Nigerian market context

---

## 17. Geo-Lift Studies

### Purpose
Isolate the causal effect of a media investment (typically OOH or events) in one city by comparing against an unactivated control city.

### Methodology
1. Define treatment city (where campaign runs) and control city (no campaign)
2. Collect weekly signal data (sentiment score, vanity link visits, or sales proxy) for both cities for the campaign duration
3. Compute Pearson correlation between treatment and control
4. AI interprets: if treatment and control are highly correlated, the treatment city's results may be explained by broader market forces, not the campaign. If correlation is low or negative, the campaign likely drove incremental results.

### Known limitation
GeoLift requires consistent data collection in both cities. If social data is skewed toward one city (common in Nigeria where Lagos dominates social volume), the study will be less reliable for other cities. BrandGauge flags this limitation when Lagos is the control.

---

## 18. AI Model Routing

BrandGauge routes AI tasks to three tiers to balance quality and cost:

| Tier | Model | Used for |
|---|---|---|
| Cultural | Claude Haiku 4.5 | Sentiment classification, Pre-Post scoring, cultural resonance, language-sensitive tasks, media plan column mapping |
| Structural | Claude Sonnet 4.6 | Creative analysis, influencer scoring, funnel diagnosis, competitive briefings, radio/TV/print AI analysis, survey clustering |
| Board-grade | Claude Opus 4.8 | Business cases, board-level strategic recommendations, deep synthesis tasks |

No model names are displayed in the product interface.

---

## 19. What is Built vs What is Planned

### Built and live
- Brand Health Index (3-component and 7-component)
- Social Sentiment Intelligence (blended scoring, emotion detection, alerts, topic clusters)
- Share of Voice tracking
- Brand Funnel (6 stages)
- NPS and NPS Tracker
- Pre-Post Content Intelligence (text, image, video)
- Cultural Resonance Score and Cultural Calendar
- Influencer Intelligence (Cultural IQ, Risk Score, Brand Fit)
- Creative Analysis (A/B Compare, Identity Check, Competitor Watch, Video Analysis)
- OOH Intelligence (vanity links, search uplift, GeoLift)
- Radio Intelligence (import flow, daypart analysis, AI layer)
- TV Intelligence (import flow, GRP/CPRP/CPT, AI layer)
- Print Intelligence (import flow, readership, QR attribution, AI layer)
- Digital Campaign Intelligence (Meta/Google/X campaign management, ROAS tracking)
- Competitive Intelligence (sightings, ESOV league, weekly briefings)
- Brand Equity Tracker (ESOV engine, perception radar, EMV, budget simulator)
- Survey system (6 templates, distribution, AI analysis)
- AI Command Layer (Ask AI, Business Case generator, Monthly Report, Funnel Diagnostic)
- Email Connectors (Mailchimp, Brevo — encrypted API keys, daily sync)
- GA4 Connector (OAuth, daily metrics pull)
- Payment Webhooks (Paystack, Flutterwave — purchase and loyalty signals)
- App Store / Play ratings fetcher
- Event Intelligence (wizard, ambassador PWA, live dashboard, debrief, ROI report)
- Campaign Hub (all campaigns, OOH and event linking, performance tab)
- PR Tracking module

### Planned (ideated, not yet built)
- **Audio Transcription Module**: Radio spot and podcast ad performance tracking via Whisper transcription + Haiku analysis. Waiting on API access.
- **SDK + JS Pixel**: BrandGauge website pixel for Action and Loyalty stage direct data capture. Feeds funnel bottom.
- **WhatsApp Broadcasting**: Campaign-level WhatsApp message sends for survey distribution and event reminders.
- **Competitive SOV auto-discovery**: Automated competitor handle detection from social conversation (currently manual).
- **Brand Tracking Panel**: Monthly recurring survey panel for tracking aided/unaided awareness, brand preference, and purchase intent over time (as distinct from one-off surveys).
- **Sector Benchmarking**: Compare your BHI, SOV, and NPS against Nigerian category averages (requires aggregated anonymised peer data).
- **Media Mix Modelling (MMM) Lite**: Regression model that attributes sales/conversion variance across OOH, Digital, Radio, TV, and Print spend — the most requested feature from CMO users.

---

*Document version: 2026-06-20. Update whenever a new measurement methodology is added or changed.*
