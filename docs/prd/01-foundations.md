# BrandGauge: Product Requirements Document
## Document 1 of 5: Foundations & Architecture

| Field | Value |
|---|---|
| **Product** | BrandGauge |
| **Document** | 1 of 5: Identity, Vision, Problem, Verticals, Personas, Theory, the Unified Funnel |
| **Version** | 8.0 |
| **Owner** | Emmanuel Femi-Adejobi |
| **Status** | Live product. This set documents what is built, what is not, and why. |
| **Last updated** | 14 September 2026 |
| **Supersedes** | BrandPulse AI PRD v6 (Parts 1 to 3, May 2026) and Document 4 Build Guide v6.0 |
| **Reads with** | Doc 2 (Modules, Tools & Data) · Doc 3 (Roadmap, Prompts, Metrics, Risk) · Doc 4 (Build Guide) · Doc 5 (Design System & Decisions Register) |

> BrandGauge tells emerging-market marketing teams not just what people think of their
> brand, but why they think it, what is changing, what to do next, and how to prove the
> spend was worth it, across digital and physical signals at the same time.

---

## What changed in v8 (read this first)

v6 was written in May 2026 as a plan. Four months of building later, it describes a product
that no longer exists in that shape. v8 is the first version of this set written against a
running codebase rather than an intention. Six changes matter most:

1. **The product is called BrandGauge.** It was BrandPulse AI through v6. The rename came
   with a complete visual identity, and that identity is now a contract with its own
   document (Doc 5). v6 had no design section at all.
2. **Every item carries a status.** v6 listed features. v8 marks each one Built, Inert,
   Deferred or Dropped, defined below. A plan that cannot tell you what is finished is not
   a plan any more, it is a wish list.
3. **Verticals became a mechanism, not a set of examples.** v6 had eight illustrative
   customer scenarios. The product now has two real taxonomies in code that branch scoring,
   navigation and recommendations. Section 3 replaces the scenarios with both.
4. **The roadmap did not survive contact.** Phases 1 and 2 shipped roughly as written.
   Phases 3, 4 and 5 interleaved, and about twenty modules exist that v6 never described.
   Doc 3 states where the build actually is rather than pretending the sequence held.
5. **Several v6 decisions were reversed.** SMS and USSD are gone, QR is demoted, Antigravity
   is not part of the build, model IDs were replaced by tier routing, billing moved to
   Paystack and got deferred. Every reversal is recorded with its date and reason in the
   decisions register (Doc 5) so it cannot creep back in.
6. **Security learning got promoted into the spec.** A class of cross-tenant bug found on
   11 July 2026 produced a rule about service-role access that now belongs in the
   requirements, not in a commit message. Doc 2 section E carries it.

---

## 0. How to read this set

Five documents, one product. Read them in order the first time, then treat them as a
reference library.

| Document | Answers | Primary reader |
|---|---|---|
| **Doc 1 (this one)** | What are we building, for whom, and on what architecture? | Anyone, first read |
| **Doc 2** | What is in each module, what is built, and what is the data model? | Engineers, you |
| **Doc 3** | Where is the build, what is next, and how is it measured and de-risked? | You and the coding agents |
| **Doc 4** | How do I actually build and ship on this stack? | You, at the keyboard |
| **Doc 5** | What does it look like, and what did we already decide? | Anyone touching UI or reopening a settled question |

Every metric, tool and feature maps back to one structure: **the Unified Brand Funnel**
(Section 6). When in doubt about where something belongs, find its funnel stage.

### Read the locked decisions table first

**At the start of any session that touches these documents, read the locked decisions table
in Doc 5 before editing anything.** The check is explicit, never assumed. A table nobody
reads is decorative, and the whole point of it is that it survives between sessions when
nothing else does.

Most of the reversals recorded there were not overturned by anyone proposing to reopen them.
They were overturned by a small change that was functionally the same reversal wearing
different clothes. Each entry carries a **watch for** field naming that pattern.

A locked decision is never silently updated. Changing one means naming the decision, stating
the reason, listing what it touches downstream, and confirming with Emmanuel before writing
anything.

### Which document wins when two disagree

These documents are a reference library. Each is authoritative on its own territory and
dependent on the others, so updating one means checking what references it.

| The disagreement is about | Authority |
|---|---|
| What a feature does | Doc 2, the module spec |
| What order things get built in | Doc 3, the roadmap |
| Stack, tooling, versions, commands | Doc 4, the build guide |
| Anything that looks like colour, type, motion, or component behaviour | Doc 5, and behind it `brand/DESIGN-SYSTEM.md` |
| A decision that was already made | **Doc 5's locked decisions table, which beats every other document** |
| Market reality | **Emmanuel's stated correction, which beats everything including the table** |
| The code and any document | **The code wins and the document is wrong. Fix the document.** |

### The status legend

Four states, used on every item in Docs 2 and 3.

| Mark | State | Means |
|---|---|---|
| **Built** | Built and driven | The code exists and the flow has been exercised. Where a module ships behind a connector that has credentials, this also means data has flowed. |
| **Inert** | Built but inert | The code is complete and type-checks, and it cannot run because a named credential or environment variable is missing. The document names the variable. Never promise one of these to a customer without checking the variable first. |
| **Deferred** | Deferred by decision | Specified, not built, and the decision to wait was deliberate. The document says what it is waiting for. |
| **Dropped** | Dropped | Specified in an earlier version and deliberately removed. The document says why, and Doc 5 records the date. |

An item with no mark is narrative, not a deliverable.

**How this set was verified.** Status marks come from reading the repository: the migration
set, the route tree, the Inngest function list, the AI client, the industry configuration
and the environment variables each connector reads. They do not come from memory of what
was built. Where a mark could not be established from the code, the document says so
rather than guessing.

---

## 1. Identity and history

The product shipped its first three PRD versions as **BrandPulse AI**. It is **BrandGauge**
from the v3.4 identity onward, and the rename is not cosmetic. The name carries the central
idea: a gauge is an instrument, it reads a value, and a reading is a claim you can act on.
That idea now governs the interface, the component set and the motion law, all of which are
specified in Doc 5.

Nothing in the product should say BrandPulse. Nothing in the product should display the name
of an AI model either: that is a hard rule, recorded in Doc 5.

---

## 2. Vision, philosophy and design principles

### 2.1 Vision statement

The most consequential brand decisions in emerging markets are made without data. Not
because the data does not exist, but because the tools to collect it, connect it and read it
were built for markets where brand perception forms inside digital channels. In Nigeria,
Ghana and across West Africa, perception forms somewhere else: at an agent's kiosk, in a
church announcement, through a WhatsApp voice note, on the back of a danfo, and in the
conversation a trader has with a customer over a carton of product.

BrandGauge is a single operating system where every brand signal, digital or physical,
quantitative or qualitative, public or private, flows into one intelligence layer that tells
a marketing team exactly where their brand stands, where it is heading, and what to do about
it.

It serves marketing teams in Nigeria and West Africa first, with a path to Sub-Saharan
Africa. It is necessary because the alternative today is either an enterprise platform that
costs more than a Nigerian brand's entire research budget and still cannot read Pidgin, or a
spreadsheet stitched together by an analyst who spends most of the week collecting data and
almost none of it thinking.

### 2.2 Four design principles

**Principle 1: collection before intelligence.** A platform is only as smart as the data
flowing into it. Every module ships with a purpose-built collection tool: a form, a mini-app,
a survey, an audio recorder, a public scan. Data is created as a by-product of doing the
marketing job, not as a reporting chore bolted on top.

> **Amended in v8.** v6 listed "an SMS survey" among the collection tools. SMS and USSD are
> Dropped (Doc 5, decision 3). Surveys deliver by email, in-app, WhatsApp and shareable
> link, and nothing else.

**Principle 2: culture is the explanatory layer.** Standard metrics describe outcomes.
Culture explains causes. Every funnel drop-off, every sentiment shift, every campaign that
underperformed has a cultural dimension that English-centric analytics will never surface.
Culture is a first-class data layer beneath every stage, not a quarterly slide.

**Principle 3: the funnel is the spine.** Every module, metric and data source maps to a
stage in the brand decision journey. No metric exists in isolation. Every number has a funnel
position, a competitive context and a cultural diagnosis attached to it.

**Principle 4: AI makes it interrogatable.** Every connected source is reachable through a
plain-language question. A marketer should not have to be an analyst to get an answer.

**Principle 5, added in v8: the instrument is honest about itself.** A score computed from
three of seven components says so. An answer built on two-week-old data says so. A chart with
no data names the action that would fill it. This principle was implicit in v6's Data
Coverage bar and is now explicit, because it is the thing that separates the product from a
dashboard that guesses confidently.

### 2.3 Differentiation from global platforms

| Dimension | Global tools (Sprinklr, Brandwatch, Hootsuite, Semrush) | BrandGauge | Status |
|---|---|---|---|
| Cultural intelligence | English-centric NLP | Pidgin, Yoruba, Igbo, Hausa interpreted in context, not translated literally | Built |
| Offline signal collection | Not supported | Events, field reports, ambassador capture, market intercepts, trade partner metrics | Built |
| Funnel integration | Channel-by-channel silos | Every metric maps to a stage; drop-off diagnosed across channels, and the signal set branches by brand type | Built |
| Data collection tools | Relies on external tools | Built-in surveys, ambassador PWA, intercept widget, vanity links, field reports | Built |
| Competitor intelligence | Needs competitor account access | Autonomous public-data crawling: press, profiles, ad libraries, app reviews | Built |
| Emerging-market sources | Global social only | Nigerian press feed, field reports, trade partner signals, regulatory mentions | Built |
| Visual brand detection | Basic logo match | Untagged brand appearances at events and on social | Built |
| OOH measurement | None | Site database, reach model, cultural-zone tagging, vanity link plus UTM attribution, search-uplift corroboration | Built |
| AI answer engine over everything | Bolted-on chat | The AI Command Layer is the primary surface, cited and confidence-rated | Built |
| Free public entry point | None | The category press scoreboard: a brand can get a real reading with nothing connected | Built |
| Language support | English UI | English primary; local languages in field tools and surveys | Built |
| Price | Enterprise tier | Accessible tiers from a startup price point upward | Deferred (Doc 3 section E) |

### 2.4 Why emerging markets need a purpose-built tool

Brand building in Nigeria and West Africa runs on infrastructure that global tools do not
see. Trust travels through people before it travels through screens. A fintech's agent is the
brand for the customer standing in front of them. FMCG brands are made or broken by how
market traders talk about them, because the trader is both distributor and influencer.

Community structures carry brand signal at scale. Churches, mosques, age grades, town unions,
market associations and alumni networks all function as brand amplifiers or destroyers, and
their verdicts move through WhatsApp and word of mouth long before they show up in a search
trend. A brand can be loved in a thousand group chats and invisible to every analytics
dashboard at once.

Cultural events are not background, they are the calendar marketing runs on. Detty December,
Sallah, the New Yam Festival, Ojude Oba, school resumption and payday cycles each create
windows where the right move builds years of equity and the wrong move burns it. A tool that
cannot see this calendar cannot explain why a campaign that worked in Lagos fell flat in
Kano.

---

## 3. The problem, and who has it

### 3.1 The three structural gaps

**Gap 1: the offline perception gap.** Most brand trust forms offline. An agent network
shapes perception for more consumers than any digital campaign. FMCG brands live or die on
trader talk in open markets. None of this is captured by any existing analytics platform, so
brands optimise the fifth they can see and stay blind to the rest.

**Gap 2: the cultural context gap.** Standard sentiment tools sort text into positive,
neutral and negative without knowing that the same Pidgin phrase can be praise or
condemnation depending on speaker, platform and context. "E don burst" is high praise. "This
brand no try at all" is damning. "Na wa o" depends entirely on the sentence around it.

**Gap 3: the funnel blindness gap.** Most tools report by channel. They do not show where in
the decision journey a consumer stalls and why. Teams end up tuning the engagement rate on a
post while the actual problem is a consideration-stage cultural mismatch in the North that no
channel report will ever reveal.

### 3.2 Verticals: the part v6 got structurally wrong

v6 listed eight customer *scenarios* as illustration. The product now has two real
taxonomies in code, and they are not the same list. This is the single biggest divergence
between v6 and reality, and getting it wrong in a spec produces features that assume FMCG.

**Taxonomy A: `brand_type` on the `brands` table.** Eight values. This is the one that
changes arithmetic. It selects the Brand Health Index component weights, and it branches the
funnel signal set. Adding a funnel signal, a BHI component or a connector recommendation
without branching on it is a defect.

| `brand_type` | Weighting logic | BHI weights (awareness / salience / sentiment / perception / cultural / SOV / EMV) |
|---|---|---|
| `fmcg` | The default. Reach and cultural resonance carry it. | 20 / 15 / 20 / 15 / 15 / 10 / 5 |
| `beverage_alcohol` | As FMCG with awareness lifted, sentiment trimmed. | 22 / 15 / 18 / 15 / 15 / 10 / 5 |
| `fintech` | Trust dominates. No OOH or events, so awareness drops. | 15 / 10 / 25 / 20 / 5 / 15 / 10 |
| `venue` | Reviews and perception are first. Salience is top-of-mind dining. | 15 / 20 / 20 / 25 / 10 / 5 / 5 |
| `b2b_saas` | Review-site perception drives purchase. No consumer cultural component. | 15 / 20 / 15 / 25 / 0 / 20 / 5 |
| `marketplace` | Balanced, with perception raised for seller and buyer trust. | 20 / 15 / 20 / 20 / 10 / 10 / 5 |
| `b2b_distribution` | Trade partner perception and share of voice. | 15 / 20 / 20 / 20 / 5 / 20 / 0 |
| `agency` | Reputation and trade-press visibility win new business. The agency is not its own end brand, so cultural resonance is zero. | 10 / 15 / 20 / 30 / 0 / 20 / 5 |

Weights are per brand type and remain user-adjustable per brand. Where a component has no
data, its weight is redistributed across the components that do, and the resulting coverage
percentage is displayed. A score is never silently computed from a third of its inputs.

**Taxonomy B: `IndustryId`, the onboarding industry list.** Twelve values: `fmcg`,
`fintech`, `telco`, `qsr`, `ecommerce`, `media`, `healthcare`, `real_estate`, `insurance`,
`fashion`, `agency`, `other`. This one does not touch arithmetic. It drives four things:
which navigation paths are hidden, which connectors are suggested, which dashboard template
loads, and which starter AI prompts and key metrics appear.

> **Open question, raised in v8 and not yet settled.** Two overlapping taxonomies is one too
> many. They share only `fmcg`, `fintech` and `agency`. A venue is a `brand_type` and not an
> industry; a telco is an industry and not a `brand_type`. Either they should be reconciled
> into one list with two attribute sets, or the boundary between them should be written down
> and defended. Doc 3 carries this as open work, not a defect, because both lists currently
> do their own job correctly.

### 3.3 The eight v6 scenarios, and what became of them

Keeping the mapping visible so the scenarios are not re-derived from scratch.

| v6 scenario | Served today as | Status |
|---|---|---|
| Fintech | `brand_type: fintech`, industry `fintech`, with a fintech metrics table | Built |
| FMCG | `brand_type: fmcg`, industry `fmcg`, trade partner metrics | Built |
| Telecom | Industry `telco` only. No `brand_type`, so it scores on FMCG weights. | Built, with the gap noted above |
| Challenger / startup | Not a type. Served by the public scoreboard as a free entry point, then any type. | Built |
| Bank / insurance | Industry `insurance`. Closest `brand_type` is `fintech`. | Built, same gap |
| Entertainment / events | Not a type. The event and sponsorship module serves the use case. | Built |
| NGO / social impact | Not served. No type, no industry, no signal set. | Dropped as a launch target |
| Agency (multi-client) | `brand_type: agency`, industry `agency`, plus the client portal | Built |

The two field-research scenarios (FMCG trade intelligence, the sponsorship decision brief)
both survive: the first as the field intelligence module, the second as the sponsorship
events and business case surfaces.

---

## 4. Target users and personas

Carried from v6 with a status column. The personas held up well, which is worth saying: four
months of building did not invalidate any of them.

| Persona | Primary pain | Core use | Status |
|---|---|---|---|
| The Brand Owner | Cannot prove brand investment to leadership | BHI, funnel view, attribution, board pack | Built |
| The CMO | Cannot justify media budget with evidence | Share of voice position, budget planning, competitive table, board pack | Built |
| The Analyst | Most of the week collecting, almost none thinking | Automated collection, AI reports, survey automation, exports | Built |
| The Social Manager | Does not know which content drives outcomes | Pre and post analysis, content table, sentiment feed | Built |
| The Event Manager | No data to prove event ROI | Event wizard, ambassador app, automatic ROI report | Built |
| The Influencer Manager | Hard to find the right creators, cannot measure impact | Creator profiles, alignment scoring, campaign attribution | Built |
| The Creative | No data on whether creative will resonate | Pre-launch scoring, cultural flags, brand voice checker, creative fatigue | Built |
| The Media Planner | Hard to justify OOH, no cross-channel view | OOH reach model, media plan, marketing mix modelling, geo-lift | Built |
| The Field Lead | Intelligence lost after the event, no real-time data | Ambassador PWA, field reports, field sales surface | Built |
| The Agency Strategist | Manual reporting drains the team | Agency workspace, client portal, scheduled reports | Built |
| **The lead desk (new in v8)** | Signups arrive and nobody works them | The leads surface, scoped by an allowlist rather than a workspace | Built |

---

## 5. Theoretical foundations

Unchanged from v6. The product is built on four bodies of measurement science plus one
emotion model, each mapped to a functional layer so it is defensible to a board and not just
to a marketer.

**Aaker's Brand Equity Model (1991).** The five dimensions give the Brand Equity Tracker its
structure. Awareness maps to the Awareness Index and share of voice; Loyalty to NPS and
retention; Perceived Quality to the Perception Score; Associations to the salience map and
Cultural Resonance; Proprietary Assets to the visual identity monitor and the brand voice
profile.

**Keller's Customer-Based Brand Equity pyramid.** Identity, then Meaning, then Responses,
then Resonance. This is why the six funnel stages run in the order they do.

**Binet and Field's ESOV model.** Brands whose share of voice exceeds their market share grow
share; brands with negative excess share of voice erode predictably. Operationalised in the
share of voice engine and the budget planning surface.

**Byron Sharp's mental availability.** Salience is built through distinctive memory
structures linked to category entry points. Buying situations, not attributes, trigger
purchase.

**Plutchik's emotion wheel.** The eight primary emotions are the classification target of the
sentiment engine. Trust and joy build advocacy; fear and disgust are early warnings a binary
score would miss.

> **One honest caveat.** Cultural Resonance carries fifteen percent of the default BHI and
> currently computes as null for most brands, so its weight redistributes. The theory is
> sound and the component is specified; the collection that feeds it is thinner than the
> theory assumes. Doc 2, module 9 says exactly which parts exist.

---

## 6. The Unified Brand Funnel

The architectural spine, unchanged in structure since v6 and now with a mechanism v6 did not
have: **the signal set for each stage branches on `brand_type`.** A venue's awareness is not
an FMCG's awareness, and the funnel no longer pretends otherwise.

### 6.1 Six stages

**Stage 1, Awareness.** Has the right audience seen or heard of us?
Metrics: Brand Awareness Index, top-of-mind awareness, social share of voice, paid impression
share, OOH effective impressions, earned media value, share of branded search, visual brand
mentions, press mention volume, blended share of voice.
Drop-off here means the brand is not reaching, or not registering with, the audience it needs.

**Stage 2, Consideration.** Are they thinking of us when choosing in this category?
Metrics: brand salience, category entry point coverage, mental penetration rate, share of
search, content engagement rate, email open rate, video completion, organic click-through,
survey consideration score.
Drop-off means the brand is known but absent from the consideration set.

**Stage 3, Preference.** Do they want us more than the alternatives?
Metrics: brand sentiment index, cultural resonance, perception score across eight dimensions,
creative effectiveness, influencer values alignment, reputation score, review ratings and
aspect sentiment, offline word of mouth, net sentiment against competitors.
Drop-off means the brand is considered and loses the comparison, often for cultural or trust
reasons.

**Stage 4, Action.** Did they take the action we wanted?
Metrics: click-through, conversion rate, cost per acquisition, return on ad spend, downloads,
account openings, event lead capture, vanity link and UTM attributed conversions, promo code
redemption.
Drop-off means intent exists and the path to action is broken.

**Stage 5, Loyalty.** Do they keep coming back?
Metrics: NPS, retention rate, email re-engagement, customer lifetime value, repeat usage,
day 1, 7 and 30 retention, loyalty programme activity, renewal rate.
Drop-off means acquisition works and the relationship does not hold.

**Stage 6, Advocacy.** Are they telling others unprompted?
Metrics: promoter share, earned media value from organic mentions, share and referral rate,
offline word of mouth, consumer visual brand mentions, user-generated content, advocacy
scores, testimonial volume.
Drop-off means loyal customers are not becoming amplifiers.

### 6.2 Five drop-off zones with diagnosis

Each drop-off sits between two stages and is diagnosed with a formula and a set of signals.
The diagnostic does not just report the drop, it points at a primary cause category so the
team knows which lever to pull.

| Drop-off | Between | Formula | Primary diagnostic signals |
|---|---|---|---|
| **A** | Awareness to Consideration | `(Awareness − Consideration) ÷ Awareness × 100` | Low salience, weak category entry point coverage, low-resonance creative, wrong targeting, low frequency, cultural mismatch, competitor share dominance |
| **B** | Consideration to Preference | `(Consideration − Preference) ÷ Consideration × 100` | Cultural resonance under 60 in a segment, negative sentiment themes, weak trust or quality perception, low creative effectiveness, competitor cultural win, negative word of mouth |
| **C** | Preference to Action | `(Preference − Action) ÷ Preference × 100` | Conversion friction, price or access barrier, weak call to action, distribution gap, agent network failure, payment friction |
| **D** | Action to Loyalty | `(retained ÷ action cohort)` inverted | Poor onboarding, product disappointment, service sentiment crash, no re-engagement, churn cluster in a segment |
| **E** | Loyalty to Advocacy | `(referring promoters ÷ promoters)` inverted | Promoters never asked, no referral mechanic, low user content, weak community, satisfaction without emotional connection |

### 6.3 Three cross-funnel layers

1. **Cultural intelligence** runs beneath every stage and supplies the why behind every drop.
2. **Competitive intelligence** mirrors every stage, so no metric is read in a vacuum.
3. **Offline signal** surfaces community, trade, event and field data and injects it into the
   relevant stage.

### 6.4 Visualisation

A horizontal waterfall, one band per stage, width proportional to score, drop-off shown in
the gap. Hovering a drop-off gives the cause category, the supporting signals with data
references, the top recommendation and an action that pre-loads the AI chat with the
diagnostic context. A segment selector re-runs the whole funnel for any audience segment,
which is where a North versus Lagos divergence becomes visible.

The colour treatment is **not** the green, amber and red v6 specified. Polarity in this
product is forest green, ash and flare, with direction carried by glyph rather than hue, and
severity must survive greyscale. See Doc 5.

---

## 7. Module map

The map that holds the set together. Full detail and per-sub-feature status in Doc 2.

| Module | Name | Owns | Primary stages | Status |
|---|---|---|---|---|
| 5 | Digital Intelligence Hub | Social, paid, email, search, app analytics, the pre and post widget | Awareness to Action | Built |
| 6 | Brand Equity Tracker | BHI, share of voice, excess share of voice, salience, earned media value, perception, reputation | Awareness, Consideration, Preference | Built |
| 7 | OOH & Media Intelligence | Site database, reach model, cultural zones, search uplift, spend attribution | Awareness | Built |
| 8 | Brand Sentiment Suite | Social sentiment, audio transcription, surveys, NPS, offline discourse | Preference, Loyalty, Advocacy | Built |
| 9 | Cultural Intelligence Engine | Cultural resonance, calendar, audience profiling, drift, language | Cross-funnel | Partly built, see Doc 2 |
| 10 | Event & Sponsorship ROI | Event wizard, ambassador PWA, live dashboard, visual detection, ROI model | Awareness, Action, Advocacy | Built |
| 11 | Influencer Intelligence | Creator discovery, alignment scoring, attribution, risk | Consideration, Preference | Built |
| 12 | Competitive Intelligence | Scorecard, share of voice league, activity feed, sightings, weekly briefing | Cross-funnel | Built |
| 13 | Creative Analysis | Pre-launch scoring, effectiveness, visual identity, competitor creative, fatigue | Preference, Awareness | Built |
| none | AI Command Layer | Plain-language interrogation of every source, report generation | All | Built |
| 14 | Data Collection Tools | The tool suite that feeds everything | All | Partly built, see Doc 2 |
| 15 | Emerging Market Feature Set | Multi-currency, low data, multi-language, workspaces, WhatsApp first | All | Partly built, see Doc 2 |

### 7.1 What exists that v6 never described

Surfaces were built that have no entry in the v6 module map. Before listing them, the test
that decides whether each is a module or a sub-feature: **a module owns a distinct piece of
the spine that nothing else covers.** Everything else is depth inside an existing module.
Applying that test honestly cuts the list roughly in half, and the halves belong in different
places.

**Genuinely new modules.** Each owns a funnel stage or a question no existing module covers.
Specified in Doc 2 section C.

| New module | Owns | Why it is not a sub-feature |
|---|---|---|
| Budget planning and actuals | Plan against spend against return | Nothing else held the plan side of the number |
| Marketing mix modelling | Which channel moved the number | The rigorous replacement for module 7.6's estimate |
| Geo-lift studies | Did the campaign cause the lift | Causal claim, not a correlation like 7.4 |
| A/B experiments | Which version wins | Own data model, own statistics |
| Customer data platform and first-party capture | Data the brand already owns | An input layer, not an analysis |
| Loyalty | Stage 5, directly | v6 measured loyalty and never collected it |
| Retention | Stage 5 cohorts | Reads loyalty and purchase data |
| Advocacy | Stage 6, directly | Same gap as loyalty, at the other end |
| Marketplace | `brand_type: marketplace` | A vertical v6 did not have |
| PR and press | Earned coverage as a first-class channel | v6 had press only as a competitive source |
| Radio, TV, print | Three broadcast and print channels | v6 deferred all of it to phase 5 |
| Leads and the lead desk | Our own funnel, not a customer's | The only surface not scoped to a workspace |
| Public scoreboard | A stranger's first reading | The only unauthenticated surface in the product |

**Depth inside existing modules, not modules.** Creative library and creative fatigue belong
to module 13. Campaigns and campaign targets belong to module 5. YouTube belongs to module
5's connector set. Voice builder belongs to the pre and post widget it feeds. AI visibility
belongs to module 12, because what it measures is competitive presence. Board pack, business
case and scheduled reports belong to the AI Command Layer. Methodology, tours, notifications,
plan limits and settings are platform surfaces rather than modules at all. Doc 2 files each
of these under its parent rather than promoting it, and this is the correction: **depth
within modules beats breadth of modules**, and a growing module count is usually the first
sign that sub-features are being promoted.

That said, none of it is scope creep to apologise for. Most came from the industry coverage
work, and each item serves a `brand_type` v6 did not have. It does mean the v6 module
numbering has stopped being a useful index, which Doc 2 addresses by grouping rather than
renumbering.

### 7.2 The two features that were called non-negotiable

v6 named the **AI Command Layer** and the **Pre-Post Content Intelligence Widget** as the two
highest-priority features. Both are Built, both are in daily use, and that call was correct.
The Command Layer is what turns a wall of dashboards into answers. The pre and post widget is
the habit-forming hook.

v8 adds a third that v6 could not have known about: **the public category scoreboard.** It is
the only surface a stranger can use with nothing connected, it is the top of the lead funnel,
and it exists because the honest answer to "why would anyone try this" needed to be something
other than "book a demo."

---

## Next actions (Doc 1)

Every item carries an owner and a date. An action with neither is a wish.

| # | Action | Owner | By | Blocking |
|---|---|---|---|---|
| 1 | **Settle the two taxonomies** (Section 3.2). Either reconcile `brand_type` and `IndustryId` into one list with two attribute sets, or write the boundary down and defend it. Until then telco, insurance and healthcare brands score on FMCG weights, which is wrong for all three. | Emmanuel | 30 Sep 2026 | Yes, gates any new vertical |
| 2 | **Decide whether telco gets a `brand_type`.** It is a large category here, it is an industry with no weighting, and it is the clearest case of action 1 doing damage. | Emmanuel | 30 Sep 2026 | Falls out of 1 |
| 3 | **Confirm NGO stays dropped.** A v6 scenario with no type, no industry and no signal set. If it is a target it needs all three, which is a week of work, not a checkbox. | Emmanuel | 30 Sep 2026 | No |
| 4 | **Fund the cultural resonance collection or lower its weight** (Section 5). A component carrying fifteen percent of the headline number and computing as null for most brands is a weight that should be earned or reduced. | Emmanuel decides, Claude Code builds | 15 Oct 2026 | Yes, gates five deferred sub-features in module 9 |
| 5 | **Read Doc 2** for module detail and status, then Doc 3 for what to build next, then Doc 5 before changing any settled decision. | Anyone joining | First session | No |

*End of Document 1 of 5.*
