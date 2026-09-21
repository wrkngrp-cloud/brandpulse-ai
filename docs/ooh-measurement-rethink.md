# Rethinking OOH measurement for BrandGauge

**Status:** research and recommendation. Not a locked decision yet. Written 21 September 2026.
**Scope:** how out-of-home advertising is measured and attributed globally, which of those
methods survive contact with Nigeria and West Africa, and what BrandGauge should build.
**Affects:** Module 7 (OOH & Media Intelligence), locked decision LD-4, the geo-lift job,
the marketing mix model, the survey suite.

---

## 1. The problem, stated plainly

BrandGauge's current OOH attribution path is a branded vanity link plus UTM at `/go/[slug]`,
with branded search uplift as corroboration, and QR as a secondary toggle. That is decision
LD-4 in Doc 5.

The premise behind LD-4 is sound: a vanity link survives a photograph, a screenshot and a
repost, and QR only works if someone points a camera at it. But both halves of that argument
assume a viewer who is holding a phone, reading a small line of copy, and choosing to act.
That viewer mostly does not exist on a Lagos roadside.

Three observations kill the primary mechanism:

1. **The creative has no room for a URL, and that is a rule, not a failure of discipline.**
   The OAAA's own benchmark is seven words or fewer, and the working guidance for large
   roadside formats is six to eight words total. Average viewing time is three to five
   seconds at speed. A vanity slug is not competing for leftover space on the artwork, it is
   competing against the entire word budget of the medium. When a planner drops the link to
   4% of the plane, they are obeying the effectiveness rules correctly. The link loses
   because it should lose.
2. **Attention sets a hard ceiling.** Lumen's eye-tracking work with JCDecaux puts actual
   attentive dwell at one to two seconds, which is the longest of the major media, and that
   is the ceiling, not the floor. Anything that competes with the message reduces the thing
   OOH is actually good at.
3. **A response that costs the viewer money is a price, not friction.** See section 3. This
   is the point where the Nigerian market diverges hardest from the assumptions baked into
   imported OOH playbooks.

### 1.1 Where the starting premises held, and where they did not

These premises came from Emmanuel's reading of the market. I checked each one against
outside sources rather than accepting them, and three of the five need amending.

| Premise | Verdict | What the evidence says |
|---|---|---|
| Nobody types a billboard URL | **Holds, by mechanism rather than by measurement** | No published CTR benchmark exists for static OOH URL entry, which is itself the finding. The six-to-eight word constraint and the three-to-five second viewing window make URL entry structurally implausible. I had written that the CTR is "close to unmeasurable"; that was rhetoric, and the accurate statement is that it is not separately measured because the medium does not generate a trackable click event. |
| Advertisers do not give the link enough prominence | **Holds, and is stronger than stated** | It is not carelessness. OAAA guidance and the readability research say a roadside board should carry six to eight words. There is no version of a correct billboard that also carries a legible URL. |
| Drivers do not scan, passengers pass too fast | **Holds for moving traffic, fails at junctions** | Transit and pedestrian buys consistently outperform roadside on scan rate. QR is impractical at speed, **with a documented exception for boards near junctions, traffic lights and petrol stations where vehicles stop or slow.** In Lagos, go-slow means a large share of nominally roadside inventory is functionally dwell inventory. This is a real amendment to the blanket claim, and it changes the product rule in Layer 1. |
| Nigerians and West Africans lack a scanning culture | **Partly wrong, and getting more wrong each year** | The instrumental half of the claim holds: people scan to transact, not to browse. But the base behaviour is being built fast. NIBSS is pushing NQR as a cash alternative for small-value payments, it now supports P2P and E2P, and Lagos State alone has generated over 750,000 QR codes for water bills and land duties. Global QR payment value is projected to rise from $5.4tn in 2025 to over $8tn in 2029. The correct framing is not "Nigerians do not scan", it is "Nigerians scan to complete a transaction, and a brand page is not a transaction." |
| Scanning needs a reward, but not an app download | **Holds** | Consistent with the transactional framing above, and with the measured 0.5% to 4% conversion range for QR-based OOH, which is placement-dependent rather than flat. |

Two further findings neither of us had:

- **QR-based OOH converts at 0.5% to 4%, depending on placement.** That is low, but it is not
  zero and it is not unmeasurable. LD-4's claim that "measured scan rates did not carry the
  attribution claim" is right about the *attribution* conclusion and too harsh about the
  *response* mechanism. QR is not useless. It is misplaced.
- **Static QR codes contribute 0% of measurable events.** A static code encodes its
  destination directly, never touches a redirect service, and therefore cannot appear in any
  analytics. If any past scan-rate evidence behind LD-4 came from static codes, it measured
  nothing and was guaranteed to read zero. **This should be checked before the LD-4 amendment
  is finalised**, because it may mean the original decision rested on an artefact.

So the honest position is: **the vanity link and the QR are both response mechanisms, and no
response mechanism can carry an OOH attribution claim.** The click was never the KPI for OOH.
We imported a digital habit into a medium that does not have a click.

---

## 2. How OOH is actually measured: the six families

Everything the global market does falls into one of six families. They answer different
questions and they are not substitutes for each other.

### Family 1: Audience currencies (exposure modelling)

**The question:** how many people had an opportunity to see this face, and who were they?

This is the planning currency, and it is the oldest and most institutionalised layer. Route
in the UK, Geopath in the US, COMMB in Canada, MOVE in Australia, and the OMC currency in
South Africa all do broadly the same thing: combine traffic and movement data, a panel of
GPS-tracked people, and eye-tracking studies, then discount raw passage down to a
visibility-adjusted number.

The chain is: **Passage → Opportunity to See (OTS) → Visibility Adjusted Contacts (VAC)**.
The VAC discount is driven by panel size, distance, angle, dwell time, illumination and
position in the field of view, all calibrated from eye-tracking. Geopath calls its version
"likelihood to see" impressions. The MRC has a standards document for static impressions.

This layer is being rebuilt right now. In March 2026 Geopath and the OAAA appointed Ipsos to
run a next-generation measurement pilot launching in the second half of 2026, which tells you
that even the mature markets do not consider this solved.

**What it is good for:** planning, buying, CPM comparison, spend justification.
**What it cannot do:** tell you whether anything happened as a result.

### Family 2: Attention-adjusted exposure

**The question:** of the people who could see it, how many actually looked, and for how long?

Lumen runs an eye-tracking panel and expresses everything in attentive seconds per thousand
impressions, which lets OOH be compared directly against TV, digital, print and point of
sale. Adelaide's AU score rates an impression from 1 to 100 on its likelihood to earn
attention. In June 2026 Vertical Impression brought real-world OOH attention data into
Adelaide's omnichannel standard, which is the first time OOH attention has sat inside a
cross-channel media quality metric.

**What it is good for:** creative and format decisions, and defending OOH in a cross-channel
budget argument where digital claims cheaper impressions.
**What it cannot do:** attribute outcomes. Also: the panels are Northern-hemisphere and the
models do not transfer cleanly to a market with different road layouts, vehicle mix, and
pedestrian density.

### Family 3: Device-graph and mobile location attribution

**The question:** did people who passed this site later visit the store, or convert?

The method: draw a geofence around the panel, identify device IDs that entered it during the
flight, build a matched control group of devices that did not, then observe a downstream
behaviour (store visit, app open, site visit, purchase). Foursquare, Blis, Near, Kochava and
the big DSPs all sell versions of this.

**This family is in structural decline and should not be built on.** By 2024 roughly 65 to 70
percent of iOS users had opted out of IDFA, so deterministic attribution lost most of its
population. Google retired the Privacy Sandbox initiative in October 2025 without a
replacement graph. The industry response has been probabilistic modelling layered on a
shrinking deterministic base, which means the confidence intervals widened at the same time
the vendors stopped publishing them. The current honest framing from practitioners is that
footfall attribution is a signal, not a verdict, and cannot establish causality alone.

**In Nigeria it is worse.** Location SDK density in the local app ecosystem is thin, the
device panels that exist are not representative, and the data brokers that do sell Nigerian
movement data are working from small, urban, high-income samples. Buying this would mean
buying a number we could not defend when a client asks how it was derived.

### Family 4: Causal experiments (geo holdout and synthetic control)

**The question:** did the campaign cause the lift?

Split the country into treated geographies and untreated geographies, run the media in one
set only, and compare the outcome series. The naive form is matched-market testing, which
struggles because truly matched markets are rare and spillover between adjacent cities is
common. The modern form is the synthetic control: rather than pick one control city, build a
weighted blend of many control geographies that reproduces the treated geography's
pre-period behaviour, then measure the divergence after launch. Meta's GeoLift is the
reference open-source implementation, and Google's geo experiments and CausalImpact are the
other lineage.

This is the method that has won. The consensus 2026 framework across the measurement
vendors is triangulation, with incrementality testing as the causal ground truth, MMM as the
portfolio decision engine, and click attribution demoted to a tactical signal.

Practical constraints that matter: flights need to run at least four weeks to generate
signal, the outcome series needs geographic granularity, and the test needs to be designed
before the media is booked, not after.

**Why this travels well to Nigeria:** it requires no device IDs, no panel, no consent regime
and no vendor. It requires a geographically resolvable outcome series and a media plan that
is not national-blanket. Both are achievable.

### Family 5: Econometrics (marketing mix modelling)

**The question:** across everything we spent, what did OOH contribute?

Regress an outcome series against spend by channel, controlling for seasonality, trend,
price, distribution and competitor activity, with adstock and diminishing-returns curves per
channel. Robyn, Meridian and LightweightMMM are the open implementations.

The specific technique that matters for OOH is **MMM with a geo dummy**: add a binary
"treatment market during campaign period" term to the model specification. That isolates the
OOH effect inside the channel decomposition while the model simultaneously controls for
everything else. It is the bridge between Family 4 and Family 5, and it is the single most
useful thing we could add to our existing MMM.

MMM's weakness is data hunger. It wants two to three years of weekly observations across
multiple geographies. Most BrandGauge clients will not have that on day one.

### Family 6: Survey and panel measurement (recall and brand lift)

**The question:** did the people who were exposed remember it, feel differently, and intend
to act?

Two shapes:

- **Brand lift study.** Sample an exposed group and an unexposed group, ask the same battery
  (unaided awareness, aided recall, message association, consideration, intent), and report
  the difference. Kantar and Nielsen run the syndicated versions. A recent Kantar study
  commissioned by Clear Channel found OOH outperforming several digital channels on
  attention and trust metrics.
- **Self-reported attribution.** The "how did you hear about us" field on a form or a
  post-purchase survey. The research on this is candid: it suffers recency bias, buyers
  recall the most recent or most memorable touch rather than the one that started the
  journey, and it distorts behavioural revenue by a meaningful margin. It is a compass, not
  a GPS. It is still the only mechanism that can see word of mouth and offline discovery at
  all, which is exactly the space OOH lives in.

**This family is the one that is already proven in Africa.** GeoPoll runs mobile-phone survey
panels across the continent and has a joint OOH product with Kantar Media and Cuende that
combines mobile survey data with satellite imagery to produce reach and demographic profiles
for billboards, transit and other OOH in African urban areas. GeoPoll has run exactly this
kind of study for the Outdoor Advertising Association of Nigeria.

### Family 7 (not really a family): direct response mechanisms

Vanity URLs, QR codes, promo and offer codes, unique phone numbers, WhatsApp keywords,
shortcodes, missed-call numbers. These are **response mechanisms**, not measurement systems.
They produce a floor, never a total: they capture the minority who acted immediately and
attribute nothing to the majority who were influenced.

Their correct use is as a **lower-bound trigger signal** feeding a causal model, and as a
lead-generation feature in their own right. Their incorrect use is as a headline attribution
number, which is what we are doing today.

---

## 3. What is true in Nigeria and West Africa specifically

Seven market facts that should govern the design.

1. **There is no audience currency, and one is being built.** The Outdoor Advertising
   Association of Nigeria partnered with Interaction Channel Limited to bring a 'Moving
   Audiences' measurement currency to the sector, and in June 2026 OOH Academy commissioned a
   nationwide audience behaviour study through Research Brooks with TMKG Consulting. Neither
   is a finished, licensable, panel-level dataset today. **The gap is the opportunity.**
2. **Data costs money and the viewer is paying, and it just got more expensive.** In January
   2025 the NCC approved a 50% tariff increase, the first in twelve years: 1GB moved from
   ₦287.50 to ₦431.25. Internet subscriptions then fell by 3.41 million to 138.75 million by
   July 2025, and Nigerians now spend around ₦721 billion a month on data. GSMA has warned
   that rising smartphone costs risk deepening the mobile internet gap. A scan or a link tap
   spends money on a destination the viewer did not choose. This is not friction in the UX
   sense, it is a price, and the price went up 50% while subscriptions went down.
3. **Scanning culture is transactional, and it is growing.** The correction from section 1.1
   matters here. NQR adoption is being driven hard by NIBSS and the public sector, so the
   mechanical habit of pointing a camera at a code is becoming normal. What is not becoming
   normal is scanning to browse. People scan to pay, to claim, to enter. A reward changes the
   behaviour, an app download does not. Plan for a population that knows how to scan and has
   no reason to.
4. **WhatsApp is the default interface.** It is where commerce, support and discovery already
   happen. A phone number is more culturally readable off a billboard than a URL, and people
   already have the habit of saving and messaging a number they see.
5. **Retail is substantially informal and cash-based.** Sell-out data is thin, loyalty data is
   thinner, and "store visit" as an outcome variable is weak because the store may be a kiosk
   with no digital footprint. Outcome series have to be things we can actually observe.
6. **Google Trends city-level resolution is uneven.** Share of search works nationally and for
   Lagos, and gets noisy fast below that. Any geo test design that relies solely on search has
   a resolution problem outside the top few metros.
7. **Programmatic DOOH just arrived at scale.** Polygon runs an aggregated DOOH network across
   Lagos, Abuja, Port Harcourt, Ibadan and Kano, and executed Africa's first full-scale DV360
   programmatic OOH campaign in Lagos with over 500 dynamic creative variants. The Nigerian
   OOH and DOOH market is projected at about USD 168m in 2026 growing to USD 226m by 2031.
   **Programmatic DOOH produces play-level logs with timestamp, screen and loop position.**
   That is a real exposure dataset, and it did not exist here two years ago.

---

## 4. Diagnosis

We have been trying to answer a digital question with an analogue medium. The reframe is:

> OOH does not produce clicks. It produces **exposure**, which produces **response**, which
> produces **effect**. Measure all three separately and stop pretending the middle one is the
> whole story.

Three consequences for the product:

- **The vanity link is not wrong, it is misclassified.** It should be demoted from "primary
  attribution mechanism" to "one response signal among several, reported as a floor."
- **The headline OOH number should be causal, not click-based.** Our geo-lift capability is
  the right instrument and it is currently the weakest-built part of the stack. The code
  comment in `src/lib/inngest/functions/geo-lift-study.ts` already admits it: the job reports
  a Pearson correlation between two city search series, not a difference-in-differences, and
  the fake confidence figure was correctly removed on 2 September 2026 rather than patched.
- **The method that is most proven in this market is the one we have the most unused
  infrastructure for.** Survey-based recall measurement is how OOH has actually been measured
  in Africa, and we already own a survey engine, a panel dispatch job, an intercept widget,
  an ambassador PWA and a WhatsApp business account. We are one small feature away from being
  able to run recall studies natively, and that feature is sitting in Doc 2 as Deferred.

---

## 5. Recommendation: the Exposure → Response → Effect stack

Four layers. Each is independently shippable and independently sellable. Together they are a
defensible OOH measurement product that no competitor in this market currently has.

### Layer 0. Exposure: make our impression model a defensible house currency

**What:** finish and document the reach model as BrandGauge's own audience estimate, on the
Route and Geopath pattern, sized for a market with no currency.

We already have the chain:

```
Gross Impressions     = Average Daily Traffic × Campaign Days × Visibility Factor
Effective Impressions = Gross Impressions × Demographic Fit Score
CPM                   = Site Cost ÷ (Effective Impressions ÷ 1000)
```

That is structurally the OTS-to-VAC chain. What it lacks is provenance. Upgrades needed:

- **Decompose the visibility factor** from one per-format constant into the factors the global
  currencies actually use: format and size, distance from the traffic lane, angle to the flow,
  illumination, dwell at the location (a site at a junction with a 90-second light cycle is not
  the same as a site on an expressway), and clutter (how many competing faces are in view).
  Store each factor on the site record, show the client the arithmetic.
- **Separate vehicular from pedestrian passage,** and apply different occupancy multipliers.
  Nigerian vehicle occupancy is not 1.0 and it is not the US 1.4 either. Danfo and keke
  occupancy is a real, defensible local adjustment and nobody else is making it.
- **Publish the methodology.** We already have `/dashboard/methodology`. An OOH section that
  states every assumption, every constant and every source is the difference between a number
  a media planner can take to a client and a number they cannot.
- **Grade the input.** `ooh_sites.traffic_ai_estimated` already exists. Every impression figure
  should carry its origin the way influencer post metrics carry `metric_sources`: counted,
  operator-supplied, AI-estimated, or modelled. Never let a screen imply an estimate was a
  count.

**Why this first:** it is the cheapest layer, it is the one clients see every day, it is
already 70 percent built, and it is the foundation the other three layers report against.

### Layer 1. Response: WhatsApp-first, incentive-backed, honestly labelled

**What:** replace the vanity link as the primary offline call to action with a WhatsApp
response mechanism, and relabel every response metric as a floor.

We own a BrandGauge WABA on Meta Cloud API v20.0. That changes the economics of this
completely, and it maps onto how Nigerians already behave.

The mechanic: a short, memorable keyword and a WhatsApp number on the creative. The viewer
messages the keyword. The keyword identifies the site or the city cluster. The inbound message
opens a 24-hour service window under Meta's rules, so the reply needs no pre-approved template
and costs nothing extra, which is exactly the shape of this interaction: the consumer starts
it, we respond.

Why it beats both the URL and the QR on this surface:

- A phone number is a familiar reading pattern. A URL slug is not.
- It survives being read aloud, half-remembered and acted on two hours later at home, because
  the number is a number and the keyword is one word. A URL half-remembered is a dead link.
- It spends almost no data on the viewer's side, and WhatsApp is frequently the cheapest or
  zero-rated part of a Nigerian data bundle.
- The reply can carry the incentive that makes the interaction worth starting, which is the
  thing the scanning-culture point demands.
- The inbound is a consented contact under NDPR if we handle the opt-in properly, which turns
  an OOH placement into a first-party data acquisition channel. That is a commercial argument
  a CMO will actually fund.

Design rules:

- **One keyword per site or per cluster**, not per campaign, so geography is recoverable.
- **The incentive is the point.** An airtime drop, a discount code, a draw entry, a free
  sample reservation at a named nearby outlet. No incentive, no volume, no signal.
- **Keep the vanity link,** because it costs nothing and it does survive a repost. Demote it.
- **Gate QR on dwell, not on format.** This replaces the "stationary placements only" rule I
  first drafted, because the evidence does not support a static-versus-digital or a
  roadside-versus-indoor split. The variable that predicts scan rate is how long the viewer
  is stopped. So `ooh_sites` should carry a **dwell class**: transit and pedestrian, indoor
  and mall, junction or signal-controlled, petrol station, and free-flow roadside. QR is
  permitted as a primary call to action on the first four and off by default on the last.
  In Lagos this matters more than it does anywhere the rule was written: congestion turns a
  lot of nominally roadside inventory into dwell inventory, and a site on a bridge approach
  at 6pm is a different medium from the same site at 11am. Dwell class should be time-banded,
  not fixed.
- **Never ship a static QR.** A static code cannot be measured at all, by anyone. Every code
  the product generates routes through `/go/[slug]` so it is dynamic and countable.
- **Label everything as a floor.** Every response count in the UI reads as "at least N people
  acted", never as "N people saw this and acted". This is the same discipline as
  `metric_sources` on influencer posts, applied to OOH.

**Honest limitation:** this will still be a low single-digit response rate. That is fine.
Layer 1 is not the proof. Layer 1 is a trigger signal, a lead source, and the input that makes
Layers 2 and 3 cheaper to run.

### Layer 2. Effect: a real geo holdout, and this is the headline product

**What:** rebuild the geo-lift study as a proper difference-in-differences with a synthetic
control, running against a **basket** of outcome series rather than search alone.

This is the recommendation. Everything else supports it.

The design:

1. **Treated and control geographies chosen before booking.** The media plan already lives in
   the product. The study should be designed off the plan, with the product proposing control
   cities by pre-period similarity rather than the user picking one from a dropdown.
2. **Synthetic control, not a single matched city.** Build a weighted blend of control
   geographies that reproduces the treated geography's pre-period series. This is the GeoLift
   approach and it removes the "no two Nigerian cities are alike" objection, which is the
   objection that kills naive matched-market testing here.
3. **Difference-in-differences on the outcome, with a reported effect size and an interval.**
   The change in the treated geography before versus after, against the same change in the
   synthetic control. Report a point estimate and a confidence interval, or report nothing.
   The existing code comment gets this exactly right and the fix is to implement what it
   describes.
4. **A basket of outcomes, weighted by availability.** This is the part that makes it work in a
   market with thin data:
   - Branded search volume by city (SerpAPI, and it is worth noting again that `SERPAPI_KEY`
     unlocks four features at once)
   - Direct and organic web sessions by city (GA4, already connected and encrypted)
   - WhatsApp inbound volume by keyword and city (Layer 1)
   - Vanity link visits by `geo_city` (already captured on `ooh_visits`)
   - App installs or account openings by city, where the client has an SDK connected
   - Survey-measured awareness by city (Layer 3)
   - Sales or distributor sell-in by region, where the client uploads it
   Each series that is present contributes. The study reports which series moved, by how much,
   and how many of them agreed. A lift that shows up in four independent series is a finding.
   A lift in one is a hypothesis.
5. **Minimum four-week flights, and refuse to run below the power threshold.** The product
   should tell a user their test cannot detect the effect they are looking for, before they
   spend the money, rather than produce a number afterwards that cannot support the claim.

**Why this is the right headline:** it is causal, it needs no device IDs or consent regime, it
is vendor-free, it works with the data we already have connectors for, and it is precisely what
the global market has converged on. It is also the thing a Nigerian media planner has never been
able to do and would pay for.

### Layer 3. Recall: a native mobile recall panel, which is the proven African method

**What:** ship geo-stamped intercept and recall surveys, and run exposed versus unexposed
comparisons off the OOH site database.

This is the GeoPoll and Kantar model, and we can run it natively rather than buying it.

Tool S4, "Geo-tagged intercept survey", is currently **Deferred** in Doc 2 with the reason
"Surveys have no coordinate capture". That one missing field is the only thing standing between
us and the most credible OOH measurement method available in this market. It should be the
first thing built.

The design:

- **Exposure is defined geographically, not by device.** A respondent whose captured coordinate
  or self-reported commute corridor passes within the viewing zone of a live site is exposed.
  Everyone else in the same city is a control. No device graph required.
- **The battery is the standard one:** unaided brand awareness, aided recall of the specific
  execution, message association, consideration, intent. Run a pre-wave before launch and a
  post-wave during and after.
- **Three delivery paths, all already built or nearly so:** the ambassador PWA repurposed as a
  field intercept tool near sites, the WhatsApp panel dispatch for a standing panel, and the
  in-app intercept widget for clients with a digital property.
- **Feed the result back into Layer 2** as one of the basket series, and into the BHI awareness
  input.
- **Feed self-reported attribution in too, labelled as such.** A "where did you first hear about
  us" question with an OOH option is weak evidence on its own and good evidence in a basket.
  Report it with its known recency bias stated on the screen.

**Why this layer matters commercially:** it is the only layer that produces the sentence a CMO
actually wants, which is "recall in Lagos went from 12 percent to 31 percent and it did not move
in Abuja where we ran nothing".

### Layer 4. Portfolio: MMM with a geo dummy

**What:** upgrade the existing marketing mix model to isolate OOH properly.

The current MMM in `src/app/api/mmm/run/route.ts` applies fixed effectiveness multipliers per
channel (`ooh: 1.0`, `events: 2.0`, and so on). That is a heuristic allocation, not a model, and
it cannot separate OOH's contribution from everything else that ran at the same time.

The upgrade that matters most is the **geo dummy**: a binary "treated market during flight"
term added to the specification, so the model estimates the OOH effect while controlling for all
other channels, seasonality and trend. This is the standard technique for exactly this problem,
and it makes Layer 2 and Layer 4 tell the same story instead of two different ones.

This is the lowest-priority layer because it needs the most history. It should be positioned as
the annual or campaign-portfolio view, not the campaign view.

---

## 6. What this means for LD-4

LD-4 should be amended, not reversed. Its QR reasoning still holds and should be kept. Its
elevation of the vanity link to primary mechanism is what fails.

Proposed replacement text for the Decision row:

> OOH measurement is a four-layer stack: a documented house exposure model, a WhatsApp-first
> incentive-backed response mechanism, a geo holdout with synthetic control as the causal
> headline, and survey-based recall as the market-proven corroboration. **No response
> mechanism is a primary attribution metric.** The vanity link at `/go/[slug]` is retained as
> a floor-level response signal and is reported as a floor. QR remains a secondary toggle, off
> by default on free-flow roadside inventory, and permitted as a primary call to action on
> sites whose dwell class is transit, pedestrian, indoor, junction or petrol station. Every
> code the product generates is dynamic and routed through `/go/[slug]`; static codes are not
> produced, because a static code cannot be measured by anyone.

**Before this is locked, one thing needs checking.** LD-4's stated reason is that "measured
scan rates did not carry the attribution claim". If those measured scan rates came from static
QR codes, they were structurally incapable of registering anything and would have read zero
whatever the real behaviour was. The conclusion may still be right, but it would be right by
accident. Worth confirming what was actually measured before writing the amendment into Doc 5.

And the Watch for row should gain:

> A response count presented as an attribution total. Any screen that reads "N conversions from
> this billboard" without stating that N is a floor. Also a geo study that reports a correlation
> and calls it a lift. Also a QR ruling made on format rather than on dwell.

---

## 7. Build order

Ordered by value per unit of effort. Sizes are rough.

| # | Work | Layer | Size | Depends on |
|---|---|---|---|---|
| 1 | Coordinate capture on survey responses, unlocking tool S4 | 3 | S | Nothing |
| 2 | Relabel every OOH response metric as a floor, with an origin tag like `metric_sources` | 1 | S | Nothing |
| 3 | Decompose `visibility_factor` into stored, shown component factors; add occupancy multipliers | 0 | M | Migration on `ooh_sites` |
| 3b | Add a time-banded `dwell_class` to `ooh_sites`; gate the QR toggle on it | 0/1 | S | Same migration as 3 |
| 4 | OOH section on `/dashboard/methodology` stating every assumption and constant | 0 | S | 3 |
| 5 | Geo-lift rebuilt as difference-in-differences with a synthetic control and a reported interval | 2 | L | Nothing, improves further with `SERPAPI_KEY` |
| 6 | Multi-series outcome basket for the geo study, with agreement count across series | 2 | L | 5 |
| 7 | WhatsApp keyword response mechanism, per-site keywords, inbound routing, consent capture | 1 | M | The three WhatsApp env vars |
| 8 | Recall study module: pre and post waves, exposed versus unexposed by geography | 3 | L | 1 |
| 9 | Power check that refuses an underpowered study before the media is booked | 2 | M | 5 |
| 10 | Geo dummy term in the MMM specification | 4 | M | 5 |
| 11 | DOOH play-log ingestion for programmatic inventory | 0 | M | A publisher relationship |

Items 1 and 2 are a single short session. Item 5 is the one that changes the product.

## 8. What to demote or drop

- **Demote:** vanity link visits as a headline. Keep the feature, move the number.
- **Demote:** `ooh_visits` geo-proximity attribution. The `attribution_method` enum already has
  `geo_proximity` and a confidence score, which is honest, but proximity of a website visitor's
  IP-derived location to a billboard is weak evidence and should never be the primary claim.
- **Do not build:** any device-graph or location-panel footfall attribution, whether in-house or
  bought. Family 3 is in structural decline and the Nigerian data is not representative.
- **Do not build:** camera-based audience measurement at the site. It is a hardware business, it
  carries a privacy exposure we do not want, and it only works on screens we control.
- **Watch, do not chase:** the OAAN and Interaction Channel currency, and the OOH Academy
  study. If either produces a licensable panel dataset, Layer 0 should consume it rather than
  compete with it. Our advantage is the stack, not the panel.

## 9. Risks and open questions

1. **SerpAPI still gates the search arm.** Layer 2 works without it on the other basket series,
   but it works much better with it. This remains the highest-value single credential.
2. **The geo study needs a media plan that is not national.** Clients who blanket the country
   cannot be measured this way. The product needs to say so at plan time and offer the recall
   study instead.
3. **WhatsApp keyword volumes may be small enough to be noisy** at single-site granularity. The
   fallback is clustering keywords by city or corridor, which costs site-level resolution but
   keeps the signal usable.
4. **Recall studies need a panel, and panels cost money to maintain.** The ambassador PWA route
   is cheap but produces convenience samples near sites, which is fine for intercept recall and
   not fine for population awareness. These are different claims and the UI must not blur them.
5. **Synthetic control needs a decent pool of control geographies with clean pre-period data.**
   For a brand present in three cities, this method is weak. The product should say which
   studies it can and cannot support.
6. **We would be publishing our own currency.** That invites the question "says who". The answer
   has to be the methodology page, stated assumptions, and graded inputs. Anything less and a
   sceptical media agency will take the numbers apart.

---

## 10. Sources

- [Geopath Research Methodology: Measuring Out of Home Audiences](https://support.geopath.io/hc/en-us/articles/360006652652-Geopath-Research-Methodology-Measuring-Out-of-Home-Audiences)
- [Constructing an Out-of-Home Rating, Geopath](https://support.geopath.io/hc/en-us/articles/360006951491-Constructing-An-Out-Of-Home-Rating)
- [Route vs Geopath: How OOH Audience Measurement Works in the UK and the US, Sifra](https://sifradata.com/blog/route-vs-geopath-ooh-audience-measurement)
- [OOH Audience Measurement 101, JCDecaux](https://www.jcdecaux.com/blog/ooh-audience-measurement-101-who-what-where-why)
- [MRC OOH Measurement Standards, static impressions](https://www.mworks.com/mrc-ooh-measurement-standards-behind-the-numbers-static-impressions/)
- [OMC currency OOH audience research methodology, South Africa](https://omcsa.org.za/wp-content/uploads/2025/10/OOH-Audience-Methodology-Overview-2024-04-Final.pdf)
- [Attention: The Common Currency for Media, Lumen Research with JCDecaux](https://www.jcdecaux.com/blog/attention-common-currency-media-lumen-research)
- [Attention measurement compared: Adelaide, Lumen, DoubleVerify, BAX](https://baxindex.com/insights/attention-measurement-adelaide-lumen-doubleverify-compared)
- [Vertical Impression attention data joins Adelaide's omnichannel standard](https://www.theglobeandmail.com/investing/markets/markets-news/Newsfile/2488759/vertical-impression-real-world-attention-data-joins-adelaide-omnichannel-measurement-standard-in-out-of-home-industry-first/)
- [IDFA in 2026: a complete guide for iOS marketers, Branch](https://www.branch.io/resources/blog/idfa-in-2026-a-complete-guide-for-ios-marketers/)
- [Mobile attribution in 2026, Moburst](https://www.moburst.com/blog/mobile-attribution-in-2026-what-marketers-actually-need-to-know/)
- [Can you really measure footfall from DOOH ads, Perion](https://perion.com/blog/can-you-really-measure-footfall-from-dooh-ads/)
- [GeoLift, Meta open-source geo-experimental methodology](https://github.com/facebookincubator/GeoLift)
- [GeoLift methodology documentation](https://facebookincubator.github.io//GeoLift/docs/Methodology/)
- [Geo experiments: the fundamentals, Haus](https://www.haus.io/blog/geo-experiments-the-fundamentals)
- [Measuring physical activations for OOH, Haus](https://www.haus.io/article/measuring-physical-activations-for-ooh)
- [How to measure out-of-home advertising: geo holdouts, MMM and incremental CPA, BlueAlpha](https://bluealpha.ai/articles/how-to-measure-out-of-home-advertising)
- [Ad measurement: the complete 2026 guide, Measured](https://www.measured.com/faq/ad-measurement-the-complete-2026-guide-to-accurate-actionable-marketing-analytics/)
- [What is marketing mix modelling in 2026, Ebiquity](https://ebiquity.com/general/what-is-marketing-mix-modelling-mmm-in-2026/)
- [Binet presents fast, cheap, predictive Share of Search metric, IPA](https://ipa.co.uk/news/binet-presents-fast-cheap-predictive-share-of-search-metric)
- [Share of Search as a predictive measure, IPA EffWorks](https://ipa.co.uk/effworks/effworksglobal-2020/share-of-search-as-a-predictive-measure)
- [Using surveys to measure out-of-home advertising, GeoPoll](https://www.geopoll.com/blog/using-surveys-to-measure-out-of-home-advertising/)
- [Audience measurement data from Africa, GeoPoll](https://research.geopoll.com/services-media-measurement.html)
- [Outdoor Advertising Association of Nigeria case study, GeoPoll](https://www.geopoll.com/resources/outdoor-advertising-association-of-nigeria-case-study/)
- [New Kantar study shows OOH outperforms key channels, Clear Channel](https://investor.clearchannel.com/news/detail/538/new-kantar-study-shows-out-of-home-advertising-outperforms-key-channels-and-addresses-gaps-in-modern-marketing-strategies)
- [Self-reported attribution: using survey data to fill attribution gaps, RankWorks](https://rankworks.com/news/self-reported-attribution-using-survey-data-to-fill-attribution-gaps/)
- [Post-purchase surveys vs tracked attribution, HYROS](https://hyros.com/updates/survey-vs-tracked-attribution/)
- [More value for OOH advertisers as OAAN and ICL partner to provide audience measurement, BusinessDay](https://businessday.ng/brands-advertising/article/more-value-for-ooh-advertisers-as-oaan-icl-partner-to-provide-audience-measurement/)
- [OOH Academy commissions nationwide audience behaviour study, Brand Impact Nigeria](https://www.brandimpact.com.ng/ooh-academy-commissions-landmark-nationwide-audience-behaviour-study-for-nigerias-ad-industry/)
- [Polygon launches DV360 programmatic billboards in Lagos, tech.africa](https://tech.africa/polygon-dv360-dooh-nigeria/)
- [Polygon launches first full-scale DV campaign in Nigeria, MarTech Series](https://martechseries.com/sales-marketing/messaging/polygon-launches-first-full-scale-display-video-dv-campaign-in-nigeria-marking-a-new-milestone-for-data-driven-outdoor-in-africa/)
- [Nigeria OOH and DOOH market size and forecast to 2031, Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/nigeria-ooh-and-dooh-market)
- [WhatsApp marketing for Nigerian businesses, 2026 guide](https://realdataintl.com/articles/whatsapp-marketing-nigeria-guide)
- [QR code scan rate benchmarks by industry, Linkbreakers](https://linkbreakers.com/help/article/qr-code-scan-rate-benchmarks-by-industry)
- [QR codes on billboards and street ads, Supercode](https://www.supercode.com/use-case/qr-codes-street-advertising-and-billboards)
- [Measure OOH ad exposure with dynamic QR codes, Broadsign](https://broadsign.com/blog/create-interactive-consumer-experiences-and-measure-ooh-ad-exposure-with-dynamic-qr-codes/)
- [NIBSS bets on QR codes as a cash alternative for small-value payments, TechCabal](https://techcabal.com/2025/02/10/nibss-bets-on-qr/)
- [Global QR code payments projected to exceed $8 trillion by 2029 as Nigeria revamps NQR, Nairametrics](http://nairametrics.com/2025/02/12/global-qr-code-payments-projected-to-exceed-8-trillion-by-2029-as-nigeria-revamps-nqr/)
- [NQR, NIBSS](https://nibss-plc.com.ng/nqr/)
- [NCC's tariff decision to drive investment in Nigeria's digital future, GSMA](https://www.gsma.com/newsroom/press-release/nccs-tariff-decision-to-drive-investment-in-nigerias-digital-future-benefitting-millions-of-consumers/)
- [Tariff hikes and data surges: Nigeria's telecom sector in 2025, Techeconomy](https://techeconomy.ng/nigeria-telecom-sector-2025-tariffs-data-growth-challenges/)
- [Life in Nigeria runs on data, and it now costs N721 billion monthly, TechCabal](https://techcabal.com/2025/09/01/nigeria-data-spend-721bn-monthly/)
- [GSMA warns rising smartphone costs could deepen Nigeria's mobile internet gap, Nairametrics](https://nairametrics.com/2026/09/16/gsma-warns-rising-smartphone-costs-could-deepen-nigerias-mobile-internet-gap/)
- [How many words should a billboard have, Trailhead Media](https://trailheadmedia.com/how-many-words-should-a-billboard-have/)
- [Billboard readability: designing for real drivers, AdCorrector](https://adcorrector.com/billboard-readability-design-for-real-drivers)
- [The 3-second rule in billboard design, AdCorrector](https://adcorrector.com/ooh-core-knowledge/3-second-rule-billboard-design)
