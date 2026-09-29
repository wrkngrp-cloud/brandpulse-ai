# BrandGauge: Product Requirements Document
## Document 3 of 5: Roadmap, Prompts, Metrics & Risk

| Field | Value |
|---|---|
| **Product** | BrandGauge |
| **Document** | 3 of 5: Where the build is, what is next, the prompts in full, metrics, risks, pricing |
| **Version** | 8.0 |
| **Owner** | Emmanuel Femi-Adejobi |
| **Status** | Live product |
| **Last updated** | 14 September 2026 |
| **Authoritative on** | Build sequence. When another document disagrees about order, this one wins. |
| **Reads with** | Doc 1 (Foundations) · Doc 2 (Modules & Data) · Doc 4 (Build Guide) · Doc 5 (Design System & Decisions) |

v6 Part 3 was a plan for six phases. Four of them happened, two of them out of order, and a
third of the product has no phase at all because it was built in response to what real use
demanded. Section A says where the build actually is rather than pretending the sequence
held. Section B carries the runtime prompts as they exist in code, not as they were drafted.

---

## A. Where the build actually is

### A.1 The phases, honestly

| Phase | v6 goal | What happened | Status |
|---|---|---|---|
| **0** | Validate that the AI reads Nigerian-language sentiment at 85 percent or better, before any feature code | Ran. The capability passed and then kept being corrected by real data: the prompt has grown from one expression table to a table plus five calibration sections (Section B.1). The gate was right and the number was not the finish line. | **Built** |
| **1** | The Input Spine: owned performance, public perception, one direct signal, plus the BHI and the answer engine | Shipped close to the plan. All three layers and both synthesis features are live. | **Built** |
| **2** | Funnel, events, audio, full surveys, OOH, sentiment engine, equity tracker | Shipped, with two exceptions: audio transcription is **Inert** for want of a credential, and the SMS arm of surveys was **Dropped** rather than built. | **Built** |
| **3** | Every specification module live | **Partly built.** Influencer, creative, competitive and the Command Layer v2 all shipped. The Cultural Intelligence Engine did not: five of its seven sub-features are deferred behind one collection dependency (Doc 2, module 9). | **Partly built** |
| **4** | Agency workspace, WhatsApp, voice builder, franchise monitor, AI visibility, billing | Shipped except billing, which is **Deferred** and moved to Paystack, and the franchise monitor, which became the venue and marketplace work instead. WhatsApp is built and **Inert**. | **Partly built** |
| **5** | Predictive forecasting, autonomous agent, multi-touch attribution, CRM, TV and radio, open API, geographic expansion, mobile app | **Jumped, partially.** TV, radio, print, the open API, webhooks and per-brand API keys are built. Marketing mix modelling and geo-lift are built and are a better answer than the multi-touch Sankey. HubSpot CRM is built and **Inert**. Predictive forecasting, the autonomous agent, geographic expansion and the mobile app are **Deferred**. | **Partly built** |

### A.2 Why the sequence broke, and whether that was a mistake

It broke for one good reason and one bad one.

**The good reason: industry coverage forced it.** Getting a second, third and fourth vertical
to a usable state needed channels and connectors that v6 had filed under phase 5, because v6
assumed a single FMCG-shaped customer. A venue needs reviews before it needs a cultural drift
monitor. A B2B distributor needs trade partner metrics before it needs an activation brief. So
work moved forward from phase 5 and the Cultural Engine slid back, and on the merits that was
the right trade.

**The bad one: the Cultural Engine slid because it is hard, not because it was deprioritised
on purpose.** Its deferral was never a decision, it was an outcome. It is the module that
carries the product's central differentiation claim, and it is the least finished. Naming that
plainly here is the point of this section.

### A.3 What is actually next

Sequenced by the question each unlocks, not by phase number and not by how impressive it is.

| # | Work | Unlocks the question | Effort | Blocked on |
|---|---|---|---|---|
| 1 | Migrate the two Africa's Talking WhatsApp paths to Meta Cloud | "Can we send at all without violating our own decision?" | Small | Nothing |
| 2 | Wire `cultural_events` into the pre and post prompt | "Is this the wrong week to post this?" The highest-traffic AI surface currently guesses. | Small | Nothing |
| 3 | Set `SERPAPI_KEY` | "Is our share of search rising?" The leading indicator, plus three other features. | None, it is a credential | Emmanuel |
| 4 | Cultural resonance collection | "Why are we losing the North?" Five deferred sub-features sit behind it. | Large | Decision on Doc 1 action 4 |
| 5 | Route hygiene: `extractJson` everywhere, tier routing everywhere, no hardcoded model IDs | "Why did that feature return nothing?" | Small | Nothing |
| 6 | Reconcile the two vertical taxonomies | "What weights does a telco score on?" | Medium | Decision on Doc 1 action 1 |
| 7 | Predictive BHI forecasting | "Where will we be in ninety days?" | Medium | Needs six months of comparable snapshots. See the `formula_version` note in Doc 2, module 6.1: the clock started 2 September 2026, so the earliest honest forecast is March 2027. |
| 8 | The autonomous monitoring agent | "What should I look at today, without asking?" | Medium | Best after 7 |

Items 1, 2, 3 and 5 are a week of work between them and clear four defects, one locked-decision
violation and four inert features. They come first for that reason, not because they are
interesting.

### A.4 Open defects

Each is a place where shipped code contradicts a stated rule. They are not feature gaps.

| Defect | Where | Contradicts |
|---|---|---|
| WhatsApp sends through Africa's Talking | `api/surveys/[id]/send-whatsapp`, `inngest/functions/panel-dispatch.ts` | Locked decision 3 (Doc 5) |
| A hardcoded model ID | The vision branch of `api/ai/pre-post` | "Model IDs are not written anywhere else" (Doc 2 section G) |
| The priority feature parses with `JSON.parse` on a fence-stripped string | `api/ai/pre-post` | The parsing rule in Doc 2, AI Command Layer |
| The pre and post widget runs on the `chat` tier | `api/ai/pre-post` | The routing table: anything touching Pidgin, Yoruba, Igbo or Hausa is `cultural` |
| `callAi` is text-only, so every vision call bypasses the wrapper | `src/lib/ai/client.ts` | The wrapper being the single entry point. This is the root cause of the two defects above it. |
| `is_workspace_member()` does not pin `search_path` | The initial schema migration | Its own sibling `is_lead_desk()`, which does |
| `lucide-react` is a dependency | `package.json` | "No icon library. Do not add one." (Doc 5). Imported nowhere, so it is dead weight rather than a live violation, and it should be removed before someone uses it. |
| CLAUDE.md claims D3 is used for Sankey and connectors | `CLAUDE.md` | `d3` is not installed and not imported. The document is wrong; fix the document. |

---

## B. The runtime prompts, in full

These are the prompts the product sends at runtime. They are reproduced as they exist in
code, because a prompt in a document that differs from the prompt in the repository is worse
than no prompt in the document.

Every call uses three layers: **Layer 1** the brand context, cached per brand; **Layer 2** the
task and the exact output shape; **Layer 3** the payload, always in the user turn. Cultural
tier calls additionally carry the mandatory cultural block.

### B.1 Bulk sentiment classification

**Tier:** `cultural`. **Source:** `src/lib/ai/prompts/sentiment.ts`.

This is the capability the entire perception layer rests on, and it is the prompt that has
changed most since v6. v6's version had one expression table. The live version has the table
plus five calibration sections, each of which exists because real Nigerian social data was
being misread in a specific, repeatable way. Those five sections are the accumulated asset
here: they are not general prompt engineering, they are this market's idioms written down.

The system turn is assembled as: an opening line naming the brand, the Layer 1 brand context
block, the cultural block, an optional correction block fed by in-product sentiment disputes,
then the task block.

**The cultural block, complete:**

```
CULTURAL CONTEXT — Nigerian and West African interpretation:
Apply the real local meaning of each expression; never use literal translation.
State confidence as High (expression is explicit), Medium (contextual reading),
or Low (inference from tone alone). Never invent data.

Expression reference:
| Expression               | Language       | Correct brand reading                           | Confidence |
| E don burst / e don die  | Pidgin         | Excellent, very impressive (positive)           | High       |
| Dem no born dem well     | Pidgin         | Bold, daring, impressive — admiration (positive)| High       |
| This brand no try /      |                |                                                 |            |
|   Una no try             | Pidgin         | Strong condemnation — "you have failed us"      | High       |
| Na wa o                  | Pidgin         | Surprise — direction set by full sentence       | Medium     |
| Omo, e sweet die         | Pidgin         | Extremely enjoyable (positive)                  | High       |
| Wahala dey               | Pidgin         | A problem is occurring (negative)               | High       |
| Ó ti ṣe tán              | Yoruba         | Approval — it is well done (positive)           | High       |
| Ó ga o                   | Yoruba/Pidgin  | Remarkable — direction from context             | Medium     |
| I hail                   | Pidgin         | Respect and acknowledgment (positive)           | High       |
| Ogun kill / God punish   | Pidgin curse   | Severe anger, condemnation (negative)           | High       |
| Una no go lack /         |                |                                                 |            |
|   no go kpeme            | Pidgin         | Blessing — "won't die, won't lack" (positive)   | High       |
| Ori ti daru              | Yoruba         | Your head is confused — "what is wrong with you"| High       |
| Onye nzuzu / iberibe     | Igbo           | Fool, idiot (negative — direct insult)          | High       |
| Agbako                   | Yoruba         | Fool, useless (negative — direct insult)        | High       |
| Oshey / Ope / Jaiye lo   | Yoruba         | Well done / thank you / go and enjoy (positive) | High       |
| Na ewu / ewu             | Igbo/Yoruba    | You are a goat — a taunt calling someone a fool | High       |
| Akudaya                  | Igbo/Yoruba    | Ghost, undead — "has become a ghost" (negative) | High       |
| Wash plate               | Pidgin         | Be publicly broke/humiliated after spending     | High       |
| Facecard never declines  | Nigerian slang | Someone's looks always work for them; "Not OPay"|            |
|                          |                | = OPay's cards decline instead (negative)       | High       |

Code-switching is normal. A post mixing English, Pidgin, and Yoruba is one item;
classify its overall intent, not each word separately.

─── SARCASM DETECTION ───────────────────────────────────────────────────────────
Nigerian digital sarcasm expresses contempt or disappointment through ironic positive
framing. Do not classify sarcasm as surprise or anticipation.
Markers:
- Absurdist exaggeration ("wake up and see opay ad in your fridge")
- Laugh-cry emoji (😭) paired with a complaint
- Reversal framing ("collect una shackles back", "who could've thought")
- Exaggerated blessing tone used to curse or mock

When sarcasm is the primary register → emotion: disgust (contempt).

─── GIVEAWAY / ACCOUNT-SHARE NEUTRALITY ─────────────────────────────────────────
Posts that contain a 10-digit account number alongside generic gratitude or blessings
("my leader", "God bless you sir", "Grateful always", "Modupe", "kunfayakun") are
directed at a third-party giver, NOT at the brand. Brand sentiment: neutral.

Similarly, a post sharing an account number to beg for emergency help (baby, medical,
urgent need) expresses personal distress, not brand dissatisfaction. Brand sentiment: neutral.

─── SCAM / SECURITY WARNINGS ────────────────────────────────────────────────────
A post alerting others or the brand about scammers claiming to be the brand
(e.g. "people calling claiming they are from opay wanting to confirm address") is an
inquiry or warning, not a brand complaint. Brand sentiment: neutral. Emotion: fear.

─── DISMISSIVE REJECTION ────────────────────────────────────────────────────────
"I no get [brand]" / "I don't do [brand]" used in a standalone or dismissive context
= negative (the speaker has actively rejected the brand). Emotion: disgust.

─── "NA EWU" TAUNTING DIRECTION ─────────────────────────────────────────────────
"na ewu" as a closing taunt means the commenter is calling the reader or the subject a
fool — implying the thing being discussed is fake or worthless. This is negative/mocking
directed at the brand or a claim about the brand. Emotion: disgust.

─── EMOTION CALIBRATION ─────────────────────────────────────────────────────────
- Prolonged service failure with emotional exhaustion ("I feel terrible", "10 days",
  "nobody picks calls", "I thought you were reliable") → sadness, not fear.
- Fear is for immediate threat, scam risk, account security, or imminent financial loss.
- When a post expresses both anger and disgust explicitly, use disgust (contempt is the
  more measured and accurate register for brand damage).
- Gratitude directed at a third-party giver (not the brand) → emotion: neutral.
```

**The task block, complete:**

```
Classify the sentiment of each Nigerian and West African social media item toward the brand.

For each item return:
- sentiment: positive | neutral | negative | mixed
- emotion: one of joy | trust | anger | surprise | disgust | fear | anticipation | sadness | neutral  (Plutchik primary)
- confidence: 0.0–1.0

Respond in JSON only — no prose, no markdown fences, preserving input order:
[{"id":"","sentiment":"","emotion":"","confidence":0.0}]
```

**Layer 3, the payload:** `Items:\n` followed by the items as indented JSON, each
`{ id, text }`.

**The correction block** is the part of this design worth protecting. A misclassification can
be disputed in product, the dispute is stored, and disputes feed back into this prompt as an
appended block. The prompt improves from use rather than from a rewrite. That feedback loop is
the long-term asset in the sentiment engine, more than any single expression in the table.

### B.2 Pre and post content intelligence

**Tier:** should be `cultural`, currently runs on `chat`. See Section A.4.
**Source:** `src/lib/ai/pre-post-context.ts`. **Route:** `POST /api/ai/pre-post`.

**System prompt, complete**, with interpolations shown in braces:

```
You are BrandGauge, a brand intelligence analyst with deep, lived knowledge of Nigerian
and West African culture, language, and social media behaviour. You interpret Pidgin,
Yoruba, Igbo, and Hausa expressions in their real cultural meaning, never their literal
English translation. You understand code-switching, Nigerian online humour, sarcasm
patterns, and the difference between how content lands in Lagos versus the North versus
the South-East.

You are analysing content for this brand:
- Brand: {brandName}
- Category: {category | "Not specified"}
- Brand values: {brandValues joined | "Not specified"}
- Brand voice: {adjectives / tone / dos / don'ts / signature phrases, or "Not configured yet"}
- Cultural profile: {culturalProfile as JSON | "Not configured yet"}
- Today's date: {YYYY-MM-DD}
- Active cultural moments: {currently the literal string "No live events loaded yet —
  score based on general Nigerian/West African cultural calendar awareness."}

You score honestly. A polished but culturally hollow post should score low on Cultural
Resonance even if it scores high on Clarity. You never invent risks that are not present,
and you never miss a real cultural tripwire.

You MUST return ONLY valid JSON in this exact shape — no markdown fences, no preamble:
{
  "engagement": {"score": 0, "reasoning": ""},
  "cultural":   {"score": 0, "reasoning": ""},
  "tone":       {"score": 0, "reasoning": ""},
  "clarity":    {"score": 0, "reasoning": ""},
  "risk":       {"score": 0, "flags": [
                  {"title":"","offending_text":"","reason":"","replacement":""}
                ]},
  "verdict": "",
  "improvements": [],
  "suggested_rewrite": ""
}
```

> The `Active cultural moments` line is the defect named in Section A.3 item 2. It is a
> literal placeholder in a shipped prompt, and it means cultural timing is scored from the
> model's general knowledge rather than from `cultural_events`.

**User message, complete:**

```
Analyse this content before it is published.
{if an image is attached:}
A visual asset is attached. Factor the image into all five scores — consider visual hook
strength (will it stop the scroll?), colour psychology and cultural visual cues for this
audience, brand aesthetic consistency, visual-text alignment, and any visual risks
(inappropriate imagery, culturally insensitive symbols, etc.).
{end if}
Platform: {platform}
Funnel goal: {funnelStage}
Target audience segment: {brand target_segments as JSON | targetSegment | "General Nigerian audience"}
Content / caption:
"""
{content}
"""
{or, with no caption: (No caption text provided — score based on the visual only.)}

Score each dimension 0-100 with specific, evidence-based reasoning:

1. PREDICTED ENGAGEMENT (0-100): likelihood of active response (comment, share, save) vs
   scroll-past. Consider hook strength, relatability, shareability, conversation triggers
   for THIS segment on THIS platform. {+ "Factor in whether the visual will stop the scroll."}
2. CULTURAL RESONANCE (0-100): authentic alignment with the target audience's culture.
   Consider language authenticity, cultural references, values fit, community feel.
   {+ "Include visual cultural signals."} If below 65, state the specific cultural improvement.
3. TONE MATCH (0-100): fit between the content's tone and the brand voice profile AND the
   audience's preference. Name any line — or visual element — that breaks the brand voice.
4. MESSAGE CLARITY (0-100): will the core message land on first read for this audience?
   Consider simplicity, jargon, assumed knowledge, language level.
   {+ "Does the visual support or contradict the text?"}
5. RISK FLAG (0-100): risk of misunderstanding, offence, or cultural backfire. 0 = none,
   100 = high. For every risk above 0, return a flag object.

Also return:
- verdict: one plain-English sentence on overall prediction.
- improvements: up to 3 specific, actionable suggestions.
- suggested_rewrite: an improved version that keeps the same message but executes better
  for this audience, platform, and cultural moment.
  {with a visual, instead: improved caption or accompanying copy that complements the
  visual better for this audience, platform, and cultural moment. Do not describe a new
  image — improve the words only.}
```

**Settings:** `max_tokens` 2000, `temperature` 0.1, `runtime = 'nodejs'`, `maxDuration` 60.
Results are stored in `pre_post_analyses`.

### B.3 The AI Command Layer system prompt

**Tier:** `chat`. **Route:** `POST /api/ai/ask`. Context assembled by
`src/lib/ai/ask-context.ts`, which builds a snapshot of which sources are connected and how
fresh each is.

The rules the prompt enforces, each of which exists for a reason:

```
- Answer first, evidence second. No throat-clearing.
- Cite the source of every factual claim, with its freshness
  (for example "Social share of voice, updated 2 days ago").
- State a confidence level: High (strong fresh data), Medium (partial or older data),
  Low (thin data). Never imply certainty you do not have.
- Interpret all local-language signals culturally, never literally.
- If you cannot answer for lack of data, say so and return a data collection
  recommendation: which tool, which module, and what it would unlock.
- When asked for a business case, activation brief, or report, produce the full
  structured document, not a summary.
- Never name the model you are.
```

That last line is a product rule, not a prompt preference. See Doc 5.

### B.4 Weekly competitive briefing

**Tier:** `structural`. **Trigger:** an Inngest cron each Monday. **Delivery:** Resend email
plus in-app. **Stored in:** `weekly_briefings`.

Output shape:

```json
{
  "week_of": "",
  "competitors": [
    {"name":"", "did":[{"point":"","source":""}], "means":"", "respond":["",""]}
  ],
  "patterns": [ {"observation":"", "recommendation":""} ],
  "headline": ""
}
```

Per competitor: three to five bullets of what they actually did, each citing its data source;
what it means for our position in the funnel; the top two recommended responses, ranked. Then
one cross-competitor pattern where any competitor shows three or more same-type activities in
fourteen days.

### B.5 Cultural fit check

**Tier:** `structural`. Scores a planned campaign against a cultural moment.

```json
{
  "cultural_fit_score": 0,
  "rationale": "",
  "timing_assessment": "",
  "conflict_flag": false,
  "conflict_reason": "",
  "creative_direction": [],
  "risk_flags": [ {"risk":"","mitigation":""} ]
}
```

Weighs tone, timing, religious and ethnic sensitivity, and the risk of looking opportunistic
or tone-deaf.

### B.6 Audio transcription hints

**Status: Inert.** The pipeline is built and no transcription credential is configured.

Transcription accuracy on local languages improves sharply with a context hint, so each
language passes a seed. The Pidgin seed, complete:

```
Nigerian Pidgin English conversation. Common words: abeg, wahala, sabi, dey, na, oga,
comot, sef, biko, omo. Speakers code-switch between Pidgin and English.
```

Equivalent seeds exist for Nigerian English, Yoruba, Hausa and Igbo, each seeded with
high-frequency words, common names, and a note that speakers code-switch. After
transcription, the `cultural` tier does sentence-level sentiment and the `structural` tier
does theme clustering and the executive summary.

### B.7 The prompt rules that apply to all of them

1. Every cultural-tier call carries the cultural block. No exceptions.
2. Layer 1 is cached per brand. It is the largest and most stable part of every prompt.
3. Output that must be JSON is extracted with `extractJson`, which takes the outermost brace
   pair. Never `JSON.parse` on a trimmed or fence-stripped string: a model will occasionally
   prefix a sentence however firmly the prompt forbids it, and the resulting throw usually
   lands in a bare catch that reports nothing, so the feature looks broken with no way to
   find out why.
4. The token budget must fit the full structured response. A truncated JSON body fails the
   same way as a prefixed one.
5. Routes that call AI set `runtime = 'nodejs'` and a `maxDuration` that fits the call.
6. Model IDs appear in exactly one file. Route by tier.

---

## C. Metric definitions

Every formula in full. Where a metric is survey-based, the update frequency reflects how
often the survey runs. The status column reflects whether the metric is computed today.

### C.1 Brand and equity

| Metric | Formula | Stage | Update | Status |
|---|---|---|---|---|
| Brand Health Index | Weighted mean of 7 components, weights per `brand_type` (Doc 1 §3.2), missing components redistributed, coverage reported | All | Nightly snapshot | **Built** |
| Brand Awareness Index | `(aided% + unaided%) ÷ 2` | Awareness | Per survey | **Built** |
| Top-of-Mind Awareness | `first unaided mentions ÷ respondents × 100` | Awareness | Per survey | **Built** |
| Brand Salience Score | `CEP Coverage% × Mental Penetration Rate` | Consideration | Per survey | **Built** |
| Mental Penetration Rate | `buyers linking brand to ≥1 CEP ÷ category buyers × 100` | Consideration | Per survey | **Built** |
| Mental Market Share | `brand CEP associations ÷ total category CEP associations × 100` | Consideration | Per survey | **Built** |
| Share of Voice | `brand visibility ÷ category visibility × 100` | Awareness | Weekly | **Built** |
| Excess Share of Voice | `SOV% − Market Share%` | Awareness | Weekly | **Built** |
| Earned Media Value | `(Impressions + Reach) × CPM_benchmark + Engagements × CPE_benchmark` | Awareness, Advocacy | Per initiative | **Built** |
| Cultural Resonance Score | `0.25×authenticity + 0.20×language + 0.20×visual + 0.20×symbol + 0.15×community` | Preference | Weekly | **Inert** for want of inputs |
| Brand Perception Score | Mean of 8 dimension scores, survey plus sentiment signal | Preference | Monthly | **Built** |
| Reputation & Trust Score | Composite of sentiment, source authority and complaint recovery, plus a negative-volume z-score against the 30-day baseline | Preference | Daily | **Built** |
| Memorability Score | `(aided recall + unaided recall)` as a trend index | Consideration | Per survey | **Built** |
| Brand Authority Score | Weighted: content volume and quality, press source authority, recognition, search authority | Consideration | Monthly | **Deferred** |
| Brand Association Delta | `post-event perception − pre-event baseline` | Preference | Per event | **Built** |
| Cultural Capital Gain | `post-event CRS − pre-event CRS` | Cultural layer | Per event | **Deferred**, depends on CRS |

### C.2 Digital and content

| Metric | Formula | Status |
|---|---|---|
| Engagement Rate | `(likes + comments + shares + saves) ÷ reach × 100` | **Built** |
| Virality Score | `shares ÷ impressions × 100` | **Built** |
| Share of Search | `branded searches ÷ category searches × 100` | **Inert**, needs `SERPAPI_KEY` |
| Content-to-Click Rate | `clicks ÷ unique opens × 100` | **Built** |
| Click-Through Rate | `clicks ÷ impressions × 100` | **Built** |
| Conversion Rate | `conversions ÷ visitors × 100` | **Built** |
| Cost per Acquisition | `spend ÷ conversions` | **Built** |
| Cost per Mille | `(spend ÷ impressions) × 1000` | **Built** |
| Return on Ad Spend | `attributed revenue ÷ ad spend` | **Built** |
| Creative Effectiveness Score | `0.25×aided recall + 0.25×message recall + 0.20×brand linkage + 0.20×emotional response + 0.10×CTA recall` | **Built** |
| Cost per Effective Impression | `site cost ÷ effective impressions` | **Built** |
| Demographic Fit Score | overlap of target and site demographic, 0 to 1 | **Built** |
| Visual Brand Impressions | `confirmed visual detections × estimated reach` | **Built** |
| AI Visibility Score | `weighted mention rate × 100`, where weight is `position (early 1.0 / mid 0.7 / late 0.4) × tone (positive 1.1 / neutral 1.0 / negative 0.9)` | **Built** |

### C.3 Sentiment, event, influencer

| Metric | Formula | Status |
|---|---|---|
| Brand Sentiment Index | `(Positive% × 1) + (Neutral% × 0) + (Negative% × −1)`, rescaled to 0 to 100 with 50 as neutral | **Built** |
| Social Score (the blended one the BHI reads) | `Σ(platform_score × platform_volume) ÷ total_volume` | **Built** |
| Emotion Distribution | a distribution across Plutchik's eight, not a single number | **Built** |
| Net Promoter Score | `%Promoters − %Detractors`, split by respondent role cohort | **Built** |
| Offline Word of Mouth Index | composite of field report, trade partner and community signals | **Built** |
| Cost per Engaged Visitor | `event budget ÷ total interactions` | **Built** |
| Event ROI | `(revenue from event leads − investment) ÷ investment × 100` | **Built** |
| Advocacy Trigger Rate | `promoters ÷ respondents × 100` | **Built** |
| Creator Values Alignment | AI-scored 0 to 100 over the creator's recent public posts | **Built** |
| Cultural IQ Score | AI composite: language authenticity, tenure in culture, organic integration, comment-section trust | **Built** |

---

## D. Risk register

Sixteen v6 risks, re-rated against what actually happened, plus four that only became visible
once the product was real. **Materialised** means it happened.

| # | Risk | Rating now | What actually happened, and the mitigation in place |
|---|---|---|---|
| 1 | Social API access revoked or restricted | **Materialised.** High / High | X app-only search returned 402 and the free tier collapsed to direct at-handle mentions. Instagram is capped at 30 hashtag queries a week. Mitigation: per-platform degradation with a staleness badge, a blocked feed distinguished from a quiet category, and no promise of broad listening on a free tier. |
| 2 | Ad library rate limits | Medium / Medium | Not yet hit, because the connector is Inert. Backoff and a 24-hour cache are written. |
| 3 | AI cost overrun | Medium / High | Controlled by tier routing, a cached Layer 1, and board-grade calls being rare. See Section E on why the v6 cost table was withdrawn. |
| 4 | Cultural misclassification | **Materialised, and being actively managed.** High / High | Every one of the five calibration sections in B.1 is a misclassification that was found and corrected. Mitigation: the in-product dispute path feeds corrections back into the prompt. This risk does not close, it is managed forever. |
| 5 | Low survey response rates | High / Medium | Unresolved and now harder: the SMS lever was removed. WhatsApp is the replacement and it is Inert. **This is the most under-mitigated risk in the register.** |
| 6 | AI hallucination on cultural facts | Medium / High | Mitigated by forced citation, stated confidence, refusal to answer past the data snapshot, and a collection recommendation instead of a guess. |
| 7 | Audio transcription quality in the field | High / Medium | Mitigated in design with per-language seeds and confidence flagging. Untested, because the module is Inert. |
| 8 | Database downtime during a live event | Low / High | Mitigated: the ambassador PWA is offline-first with an idempotency key, so a network-only write is never trusted. |
| 9 | Competitor data staleness | Medium / Medium | Daily crawl with a staleness badge. |
| 10 | NDPR and data-privacy non-compliance | Medium / High | Consent gate on every collection tool, a privacy policy page, phone numbers hashed in logs and stored E.164 only under row-level security, WhatsApp opt-in checked before any send, STOP handled inbound. **A Nigerian data-protection review is still outstanding and gates field deployment.** |
| 11 | Price sensitivity | High / Medium | Unresolved and deliberately parked: billing is Deferred, so there is no price to be sensitive to yet. The free scoreboard is the current answer to "will anyone try this". |
| 12 | Regional knowledge gaps beyond Nigeria | Medium / Medium | Mitigated by not expanding. Ghana and Kenya remain Deferred, and each needs its own reference set and test suite before launch. |
| 13 | Agency cross-brand data leakage | **Materialised in a near-miss.** Low / Critical | Three routes were found on 11 July 2026 using the service client filtered only by a request id. Fixed, and the rule is now a requirement in Doc 2 section E rather than a convention. This is the most valuable thing the register caught. |
| 14 | Offline sync conflicts | Medium / Medium | Mitigated: client UUID idempotency key with a unique constraint. |
| 15 | WhatsApp policy change | Medium / Medium | Partly mitigated and partly worse: the SMS fallback v6 relied on was removed, so WhatsApp is now a single point of failure for one delivery channel. Accepted: an email and link path always exists. |
| 16 | Field tool adoption failure | Medium / High | Mitigated: one-tap design, a leaderboard, and the "filling it is the work" rule enforced in every tool review. |
| **17** | **Two vertical taxonomies diverge** | **New.** High / Medium | Telco, insurance and healthcare currently score on FMCG weights. Mitigation: Doc 1 action 1, unowned until that decision lands. |
| **18** | **A component carrying weight computes as null** | **New, materialised.** High / Medium | Cultural resonance is 15 percent of the default BHI and null for most brands. Mitigated by weight redistribution and a visible coverage figure, so the number is honest. Not mitigated as a product gap. |
| **19** | **A stored score becomes incomparable with its own history** | **New, materialised.** Medium / High | Two BHI formulas ran concurrently, one writing history and one displaying. Fixed 2 September 2026 and old rows marked `formula_version = 1`. Mitigation going forward: any scoring change stamps a formula version and no chart crosses a version boundary silently. |
| **20** | **A stated decision is contradicted by shipped code** | **New, materialised.** Medium / Medium | Four live cases in Section A.4, including one locked-decision violation. Mitigation: the locked decisions table in Doc 5 and the session discipline of reading it first. |

---

## E. Pricing and cost

### E.1 Pricing

**Deferred** until after beta, and it will run on **Paystack, not Stripe**. Stripe code exists
in the repository, is unconfigured, and brand-limit enforcement is intentionally bypassed.
That is a known state, not an oversight, and it is a locked decision (Doc 5).

The v6 tier structure (Starter ₦49,000, Growth ₦149,000, Pro ₦299,000, Agency ₦349,000,
Enterprise ₦699,000 and up, annual at a 20 percent discount) is kept on record as a starting
point and **is not a commitment**. It was priced before the product had twenty more modules,
and it should be re-derived against what it actually costs to serve a brand, not adjusted at
the edges.

`plan_limits` and `usage_events` tables exist, so the metering that a price needs is already
collecting.

### E.2 Why the v6 cost ladder was withdrawn rather than updated

v6 Part 3 and the Build Guide carried a monthly infrastructure and AI cost table per phase.
It has been removed from this set rather than refreshed, for two reasons.

**It was priced per phase, and phases stopped being the unit.** The product is now past the
phase boundaries in a way that makes "Phase 2 total" meaningless.

**More importantly, every number in it was an estimate presented as a figure.** The AI line
was the only one that moves with usage, it was the largest, and it was guessed. A cost table
that looks precise and is not is worse than no table, because it gets quoted in a business
case.

**The honest version, with the downside next to the upside.** The fixed infrastructure line is
small and knowable: managed hosting, database, background jobs, cache, email and monitoring
sit in the tens of dollars a month at current usage and low hundreds at real customer load.
The AI line is the one that can surprise, and the surprise is asymmetric: tier routing, a
cached Layer 1 and batch processing keep it low, and a single un-cached board-grade report
loop or an un-rate-limited public endpoint can multiply it in a day. The public scoreboard is
the specific exposure, because it is unauthenticated: it is why that endpoint has an IP rate
limit and a cache in front of it.

What replaces the table: instrument it. `usage_events` is already collecting. A real
cost-per-brand figure derived from a month of actual traffic is worth more than any estimate,
and it is the input a price needs. **Owner: Emmanuel. Needed by: whenever billing is
un-deferred.**

---

## F. Decision log of exclusions

What was deliberately left out, so nobody helpfully adds it back. Locked decisions with their
full reasoning live in Doc 5; this is the scope-shaped view.

| Excluded | Why | What would bring it back |
|---|---|---|
| SMS and USSD | Deliverability and cost in this market did not justify a second gateway once WhatsApp existed; it also created a second consent regime to maintain | WhatsApp being blocked for a customer segment that cannot receive email either |
| QR as the primary offline attribution path | Scan rates did not carry the claim. A branded vanity link plus UTM survives a photograph, a screenshot and a repost; a QR only works if someone points a camera at it | Measured scan rates that beat link click-through for a real campaign |
| Africa's Talking as a WhatsApp gateway | One WABA, owned by us, with templates and consent managed in our own UI | Nothing. Meta Cloud is the architecture |
| Antigravity in the build workflow | Source is transmitted to a third party, and this product holds keys and customer data | A self-hosted agent with no egress of source |
| Opus for board-grade AI | Sonnet output was good enough at the quality bar, at materially lower cost | A measured quality gap on real business cases, not an assumption of one |
| Displaying any model name in the UI | The product's claim is the reading, not the vendor. Naming a model dates the product and invites the wrong comparison | Nothing |
| Non-Anthropic generation for our own output | One provider, one prompt discipline, one cost model. The AI visibility tracker is the sole exception because there the external models are the measured object | Nothing |
| NGO and social impact as a launch vertical | No `brand_type`, no industry entry, no signal set; it is a week of work, not a checkbox | A named customer |
| Ghana, Kenya and Francophone expansion | Each needs its own cultural reference set and its own validation test before launch | Nigeria being saturated, or a named multi-market customer |
| A React Native mobile app | The ambassador PWA covers the one genuinely mobile job without an app store | A field job the PWA cannot do |
| Multi-touch attribution with a Sankey | Marketing mix modelling and geo-lift answer the same question with a causal claim instead of a correlation | Nothing |
| Billing and brand-limit enforcement | Deferred until after beta, on Paystack | The beta ending |

---

## Next actions (Doc 3)

| # | Action | Owner | By | Blocking |
|---|---|---|---|---|
| 1 | Clear the four cheap defects in Section A.4: the WhatsApp gateway, the hardcoded model ID, the `JSON.parse` in the priority feature, and the tier on the pre and post route | Claude Code | 30 Sep 2026 | Yes, one is a locked-decision violation |
| 2 | Add a vision path to `callAi` so no route needs the SDK directly. This is the root cause of two of those defects | Claude Code | 30 Sep 2026 | No, but it prevents recurrence |
| 3 | Wire `cultural_events` into the pre and post prompt, replacing the placeholder line | Claude Code | 30 Sep 2026 | No |
| 4 | Mitigate risk 5, survey response rate. It is the most under-mitigated risk in the register and the SMS lever is gone | Emmanuel | 15 Oct 2026 | Yes for any survey-fed metric |
| 5 | Book the Nigerian data-protection review (risk 10). Longest lead time in the register, and it gates field deployment rather than launch | Emmanuel | Start by 30 Sep 2026 | Yes for field deployment |
| 6 | Derive a real cost-per-brand figure from `usage_events` over one month, to replace the withdrawn estimate | Emmanuel | Before billing is un-deferred | Yes for pricing |
| 7 | Read Doc 4 for the stack and the definition of done, and Doc 5 before reopening any decision above | Anyone building | First session | No |

*End of Document 3 of 5.*
