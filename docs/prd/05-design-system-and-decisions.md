# BrandGauge: Product Requirements Document
## Document 5 of 5: Design System & Locked Decisions

| Field | Value |
|---|---|
| **Product** | BrandGauge |
| **Document** | 5 of 5: The design system in summary, and the locked decisions register |
| **Version** | 8.0 |
| **Owner** | Emmanuel Femi-Adejobi |
| **Status** | Live product |
| **Last updated** | 14 September 2026 |
| **Authoritative on** | Every settled decision. **Part B beats every other document in this set.** |
| **Reads with** | `brand/DESIGN-SYSTEM.md`, which is the contract for Part A and beats this summary |

This document has two halves that belong together because both answer the same question:
*what has already been decided, so that I do not decide it again, worse.*

**Part A** summarises the design system. The contract is `brand/DESIGN-SYSTEM.md` in the
repository, and the values live in `brand/tokens.css`. Where this summary and those files
disagree, they win.

**Part B** is the locked decisions register. v6 had no such table, and the four months since
are the argument for one: most of what follows was decided, then quietly un-decided by a
small change that was functionally the same reversal, then decided again.

---

# Part A: The design system, in summary

The system is BrandGauge v3.4 and later. It lives in `brand/` at the repository root.
`brand/DESIGN-SYSTEM.md` is the contract, `brand/tokens.css` is the only source of colour,
type, space and motion values, and the shadcn token layer in `src/app/globals.css` only
aliases it.

**Do not invent a value, and do not reach for a hex, an `rgb()`, an `oklch()` or a Tailwind
palette class.** There are none left in `src`, and that is a state worth keeping.

## A.1 The one idea

A gauge is an instrument. It reads a value, and a reading is a claim you can act on. Every
decision below follows from that: the interface is an instrument panel, not a dashboard
template, and anything that reads as decoration rather than as a reading is wrong.

## A.2 Colour

Ground carries about three quarters of any surface: paper, shell, card, ink. **Flare is the
hero**, applied to whole planes, once per frame. It fills, it never outlines, and it is never
text. `--tx-flare` (Char) is Flare as type.

**Type on a hot plane is `--on-hot`, which is ink.** Paper on Flare measures 3.3:1 and fails.
Ink on Flare measures 5.3:1 and passes. This inverts the instinct, which is why it is in the
register.

Polarity runs one green, ash and flare:

```
positive / nominal   --pos   #345C2C   forest, hue 110, on light grounds
                             #9BC98A   the same hue lifted, on ink
neutral              --neu   #8C877E   ash
negative / alert     --neg   #FF3D14   flare
```

Hue 110 rather than 140, so it leans olive and sits with the warm ramp instead of fighting
it. It survives colour blindness because the green is dark (luminance 0.086) and Flare is
bright (0.246), so the pair is 2.2:1 apart in lightness alone and stays 2.3:1 apart under a
deuteranope simulation. The pair is separable without hue at all, which was always the
property that mattered.

The weak pair is **neutral against negative**, not positive against negative: ash at 0.244 and
Flare at 0.246 are told apart by hue alone. Where that distinction carries meaning, give it a
glyph or a label as well.

Text steps are ink lightened toward paper, shades of the ground rather than new hues, and all
three clear 7:1 on every ground: `--tx` 17.3:1, `--tx-2` 9.5:1, `--tx-3` 8.0:1 on paper.
**Ash is not a text colour.** At 3.3:1 it fails on every ground here; it keeps its other two
jobs as neutral polarity and unlit ticks, where it is a mark rather than type.

In dark mode the contrast bar is measured against the **raised card**, not the page, because
the card sits only a step off the ink ground.

## A.3 Type

Nohemi for everything, Disket Mono for numerals only, always tabular.

Four weights exist and only four: Nohemi 400, 500, 700, 800, and Disket 400 and 700. Asking
for a weight with no file resolves silently to a neighbour, which is how three weights that
never rendered ended up named in a table. Measured at 64px: 600 renders as 700 (identical
width, 469.59px), 900 renders as 800 (473.22px), mono 500 renders as 400.

**Every heading is 500. One weight, all of them, app and marketing.** Hierarchy comes from
size and tracking. 800 at display size closes the counters and reads as a wall.

**Weight is not hierarchy.** 700 says *this is actionable* or *this is the number*, and it is
allowed in exactly three places: anything you press, a numeral that is the reading, and at
most one phrase per paragraph of body copy. Never to make a heading louder.

**One marker per emphasis.** An accent word that is already Danfo-coloured does not also get
700. Colour or weight, not both.

**Capitals belong to `.bg-label` alone**, which is Disket 700 at micro size with 0.20em
tracking. That is also the single exception to *mono is never used for labels*. Everywhere
else is sentence case.

Deltas read `+` and `−`. **Disket has no triangles and the licence forbids adding them**, so
any spec calling for `▲` or `▼` is wrong.

## A.4 Surfaces, icons, charts

**Elevation is a one-pixel hairline at `--line`, never a shadow.** The only shadow in the
system is the focus ring: 2px `--flare` at 2px offset. Radius is cards 4px, controls 3px,
ticks 2.5px, status pills round. **Nothing else is rounded**, so a tag is square.

**Icons are the 113 drawn glyphs in `brand/icons/currentcolor`**, on a 24px grid with a 20px
live area, 1.75px stroke, butt caps, miter joins, built by `npm run icons`. `npm run
icons:check` fails when a glyph the product asks for was never drawn, which exists because
three onboarding cards once shipped rendering nothing.

**An icon names the thing, never the abstraction.** Marketplaces is a market stall canopy, not
three floating circles. Telco is a mast, not a signal wave. Fashion is a hanger, not a
shopping bag. An icon shared between two categories is a bug, not a saving, and a glyph
carrying two ideas collapses at 15px.

**No icon library.** There is no exception to this.

Charts: only the subject series carries heat (`--chart-1`); comparisons are neutral ink steps,
dashed for lines. Threshold and benchmark lines are hairlines, not ramp colours. Every chart
goes through `ChartState`, so it ships a chart-shaped skeleton and an empty state that names
the next action.

## A.5 Motion

One law: **the needle settles and nothing bounces.** If an animation does not represent a
value changing, a state changing, or a touch being registered, it does not ship.

Only `transform` and `opacity` are animated. Never `top`, `left`, `width` or `height`.

**Scroll may drive motion only when scroll position is itself the value being displayed**: a
progress reading, a rail, a crescendo, a section arriving. It may never drive decoration.
Where scroll is the input it must be smoothed through a spring, because a raw value applied
to a tick flickers at the boundary on a trackpad.

**A lit run carries the ramp across its whole length**, rescaled as the run grows. Heat is
never a function of distance from the head, which leaves a long run mostly in track colour and
destroys the thing the graphic is for.

**A tick may turn about its own centre to change what shows through it. It may not translate,
tilt, skew, orbit or drift.** A turn is reversible where a reveal is one-way.

**Reduced motion is honoured in CSS with `!important` on a class, never by branching a
component on a hook at render time.** A hook cannot read the query before first paint, and
swapping one component for another remounts the node and makes the flash worse.

Banned outright: parallax, scroll hijacking, marquees and infinite logo strips, numbers
counting up, hover lift, anything that loops, `window.addEventListener('scroll')`, and
fade-and-slide-up on every element (one reveal group per section, maximum).

## A.6 Photography and the logo

Three treatments: ink duotone where the claim is a number, flare duotone for street stories,
full colour for people. **People are never duotoned.**

The mark's own arc, at a tick fill above 1, is the primary way a photograph enters this brand:
seven apertures growing toward the head, so the image is discrete at the tail and solid at the
hot end. Seven ticks, never more. It waits for the image to decode.

Wherever a photograph appears it carries a reading strip: the number, the place, the number of
sources. **If a picture cannot carry a reading, it does not go out.**

The logo comes from the SVGs in `brand/logo/` through `src/components/brand/logo.tsx`. Never
redraw the mark, simplify it, or rebuild the needle from ratios. A motion version exists in
`brand/logo/motion/` in four cuts, and **the letters are never bent to fit anything**: the
mark's geometry may reveal type, it may never reshape it.

## A.7 Component contracts

Use the primitives: `Gauge`, `Crescendo` (every progress or score bar), `Meter` (every metric
row), `Readout`, `Delta`, `StatusPill`, `MentionCard`, `ReadingStrip`, `AskBar`, `Label`,
`Icon`, `Pattern`.

**Mention text stays verbatim, unglossed and unitalicised in every language.** Pidgin and
Yoruba are not translated and not italicised. That is a brand decision, not an oversight, and
it is in the register because it looks like a bug to anyone who did not make the decision.

A chip holding user content wraps: `h-auto`, allowed to shrink, `max-w-full`, with `min-w-0`
on its container. User text is never truncated and never allowed to overflow its column.

## A.8 Dark mode

1. **An inverting token can never carry fixed-inverse type.** `bg-foreground text-background`
   inverts together. `bg-foreground` with `text-tx-inv` does not, and measured 1.0:1 in one
   real case. A plane meant to be ink on both grounds is pinned to `bg-ink text-tx-inv`.
2. **A permanent ink plane on an ink ground needs a hairline**, or the split disappears.
3. **A two-file asset renders both files and switches in CSS.** No flash, no hydration
   mismatch, and no component needs to know the theme.
4. Measure against the raised card, not the page.

## A.9 Voice

Warm, confident, plain English. Active voice. Connection before sales. No jargon. **No em
dashes.** Banned words: delve, underscore, pivotal, crucial, robust, vibrant, leverage,
seamless, tapestry.

Sentence case. The button says what happens. The product speaks like a colleague who has read
the numbers: *Sentiment fell 4 points in Kano on Tuesday* beats *Anomaly detected in regional
sentiment metrics*.

## A.10 Ship audit

A screen ships when it passes the audit in section 12 of `brand/DESIGN-SYSTEM.md`. That list
is the contract; this is not a substitute for reading it.

---

# Part B: The locked decisions register

**Read this table at the start of any session that touches these documents or this codebase.
The check is explicit, never assumed.**

A decision is locked when three things hold: it was made by correcting an assumption that
keeps looking attractive, getting it wrong would mean significant rework, and the wrong
approach is the obvious one a reviewer will suggest again.

The **watch for** field is the important one. Almost nothing here was overturned by someone
proposing to reopen it. It was overturned by a small change that was functionally the same
reversal wearing different clothes.

**A locked decision is never silently updated.** Changing one means naming the decision,
stating the reason, listing what it touches downstream, and confirming with Emmanuel before
writing anything. If the reason does not hold, the decision stays and the watch-for field
gains the new pattern.

---

### LD-1: The MVP is the Input Spine, not the answer engine

| | |
|---|---|
| **Decision** | The minimum product is three input layers plus two synthesis features, not a chat box with modules added later as depth. |
| **What it means** | Owned performance, public perception and one direct signal must all exist before the AI Command Layer is meaningful. Anything that synthesises or reasons over data gets built on real feeds, never before them. |
| **Why it's locked** | The answer engine is a function over data. With nothing feeding it, it can only answer from one connected source, which is the thinnest possible slice of the whole thesis. An early draft of v6 had this backwards and the correction re-scoped the entire roadmap. |
| **Watch for** | A new vertical being launched with one connector and an AI surface, and the answer looking fine in a demo because the demo brand has one channel. Also: "let's ship the AI part first, the data can come later." |

### LD-2: Our own generation is Anthropic only

| | |
|---|---|
| **Decision** | Every AI call that produces our output goes through `callAi` in `src/lib/ai/client.ts` and hits Anthropic. No OpenAI-compatible generation call, no NVIDIA NIM, no second provider. |
| **What it means** | One provider, one prompt discipline, one cost model. The accumulated idiom corrections in Doc 3 section B.1 are tuned to one model family and do not transfer for free. |
| **Why it's locked** | The cultural sentiment capability is the product's core differentiator and it is a prompt asset, not a model asset. Splitting it across providers means maintaining two versions of it, and the second one silently degrades. |
| **Watch for** | A single feature added with a direct provider SDK call "just for this one thing", usually for a capability the wrapper lacks. **This has already happened once**: the vision path in the pre and post route calls the SDK directly because `callAi` is text-only. That is the pattern. The fix is to extend the wrapper, never to route around it. |

### LD-3: WhatsApp is Meta Cloud API only, and there is no SMS

| | |
|---|---|
| **Decision** | WhatsApp runs on a BrandGauge-owned WABA through Meta Cloud API v20.0. Surveys deliver by email, in-app, WhatsApp and shareable link. **No SMS. No USSD. No third-party WhatsApp gateway.** Locked 11 July 2026, when the Africa's Talking NPS path was removed. |
| **What it means** | One send path, one consent regime, one delivery log. Users manage contacts and templates inside BrandGauge and never touch an API key. Consent is checked on `whatsapp_opted_in` before any send; inbound STOP sets it false. |
| **Why it's locked** | A second gateway means a second consent regime, a second deliverability profile and a second failure mode to debug, for a channel whose response rate did not justify it. Owning the WABA is also what lets the product manage templates in its own UI instead of sending people elsewhere. |
| **Watch for** | A WhatsApp send added through whatever gateway is already in `package.json`, because it is faster than waiting for Meta verification. **This is live right now**: two code paths still send through Africa's Talking (Doc 3 section A.4). Also watch for SMS returning as "a fallback", which is the same reversal with a softer word. |

### LD-4: OOH attribution is a vanity link plus UTM, and QR is secondary

| | |
|---|---|
| **Decision** | Offline attribution is a branded vanity link plus UTM as the primary mechanism, with search uplift as corroboration. **QR is a secondary toggle, off by default.** Event attribution is ambassador-captured leads through the PWA. |
| **What it means** | Every offline placement gets a short branded slug at `/go/[slug]`. The QR generator still exists and is not the default path. |
| **Why it's locked** | A vanity link survives being photographed, screenshotted, reposted and read aloud. A QR only works if someone points a camera at it, and measured scan rates did not carry the attribution claim. v6 treated QR as the primary path and that was an imported best practice, not a reading of this market. |
| **Watch for** | A QR code appearing as the main call to action on a new offline surface, because it is the obvious thing to put on a billboard. Also a spec that lists "QR scan rate" as a primary metric rather than a secondary one. |

### LD-5: Antigravity is not part of the build

| | |
|---|---|
| **Decision** | Claude Code is the only builder. The v6 two-tool division of labour is withdrawn. |
| **What it means** | No second agent, no handoff workflow, no source transmitted to a third party. |
| **Why it's locked** | This product holds provider keys, service-role credentials and customer data. The free-preview data-handling terms of the alternative were broad, and a workflow that requires remembering which directories are safe to expose is a workflow that will leak something eventually. |
| **Watch for** | A second agent reintroduced "just for UI work" or "just for the marketing page", with the claim that it will not see the sensitive directories. |

### LD-6: Board-grade AI runs on Sonnet, not Opus

| | |
|---|---|
| **Decision** | The `boardGrade` tier maps to Sonnet. Confirmed 11 July 2026. |
| **What it means** | Business cases and executive documents run on the same model as structural work. The tier still exists, because it is the routing seam where that could change. |
| **Why it's locked** | Output quality at the actual quality bar was good enough, at materially lower cost per document. The upgrade was proposed on the assumption of a gap rather than a measured one. |
| **Watch for** | A well-meant "upgrade the board tier" in a tidy-up commit. The tier mapping is correct as it stands; changing it needs a measured quality gap on real business cases, not an intuition. |

### LD-7: Model IDs live in exactly one file, and no UI names a model

| | |
|---|---|
| **Decision** | `src/lib/ai/client.ts` `MODELS` is the single source of truth. Route by tier: `cultural`, `structural`, `chat`, `boardGrade`. **No model name is ever displayed in any UI**, and no model ID appears in any other file or in these documents. |
| **What it means** | Changing a model is a one-line change in one file. The documents describe tiers and never IDs. |
| **Why it's locked** | v6 hardcoded model IDs and prices into three separate documents and all three went stale within four months, which then made every other number in those documents look suspect. On the UI side: the product's claim is the reading, not the vendor, and naming a model dates the product and invites the wrong comparison. |
| **Watch for** | A model ID pasted inline for a call the wrapper does not support. **Live now**: the vision branch of the pre and post route. Also a "powered by" line, a model name in a tooltip explaining why an answer is trustworthy, or a model version in a changelog entry that renders in-app. |

### LD-8: Tenancy is row-level security, and a service client must verify ownership

| | |
|---|---|
| **Decision** | Multi-tenancy is enforced by row-level security through `is_workspace_member()`. Tenancy is never filtered in application code as a substitute. When `createServiceClient()` is used in a user-triggered request, the caller's ownership of the row must be verified manually. Locked 11 July 2026 after three routes were found violating it. |
| **What it means** | `createClient()` is the default. The service client is for webhooks, jobs, public token routes and cross-tenant admin work. A service-client query filtered only by an id from the request body is a cross-tenant hole. |
| **Why it's locked** | It already happened: the brand delete, the event visual scan and the survey analysis routes all read or wrote rows using an id straight from the request. In a product whose agency tier holds competing brands side by side, that is the one bug that ends the product rather than annoying a customer. |
| **Watch for** | A service client reached for because the row-level-security client "returned nothing", which is almost always the policy correctly refusing. Also a new public or webhook route copied from an existing one, inheriting the service client without inheriting the verification. |

### LD-9: The active brand comes from the cookie, always

| | |
|---|---|
| **Decision** | Always `getActiveBrandId()` or `getActiveBrand()`. Never `.from('brands').select(...).limit(1).single()`. |
| **What it means** | Every route that needs the current brand resolves it the same way, honouring the active-brand cookie. |
| **Why it's locked** | The `limit(1)` form works perfectly in every single-brand workspace and silently returns the wrong brand in every multi-brand one. It fails invisibly, and multi-brand workspaces are the agency tier, which is the highest-value segment. |
| **Watch for** | The `limit(1).single()` pattern in any new route, usually copied from an older one written before multi-brand existed. It looks correct in testing because the test workspace has one brand. |

### LD-10: Every funnel signal, BHI weight and connector recommendation branches on `brand_type`

| | |
|---|---|
| **Decision** | Any new funnel signal, BHI component, navigation item or connector recommendation must branch on `brand_type` rather than assume FMCG. |
| **What it means** | Eight brand types with their own BHI weights (Doc 1 section 3.2), their own signal sets, their own hidden navigation paths and their own suggested connectors. |
| **Why it's locked** | The product started FMCG-shaped and every default still leans that way. A venue's awareness is not an FMCG's awareness, and a B2B SaaS brand has no cultural resonance component at all. An unbranched signal does not error, it just quietly scores the wrong thing for seven of eight verticals. |
| **Watch for** | A new signal added with "we can branch it later", and a new vertical served by an industry entry alone with no `brand_type`. **Live now**: telco, insurance and healthcare have industry entries and no brand type, so they score on FMCG weights. |

### LD-11: The public scoreboard is the one open endpoint, and it fails open

| | |
|---|---|
| **Decision** | `/scoreboard` and `/api/scoreboard/*` are the only endpoints with no token. Their tables (`public_scans`, `leads`, `lead_desk_admins`) are the only place row-level security does not scope to a workspace: they scope to the `is_lead_desk()` allowlist and are written by the service role only. The rate limit and cache in front of them **fail open**. |
| **What it means** | A stranger gets a real reading with nothing connected, and a Redis outage degrades the free tool rather than returning an error. |
| **Why it's locked** | It reads a public news feed and touches no tenant row, so there is no caller to verify. Requiring a token would destroy the only surface that answers "why would anyone try this". Failing open is deliberate: an unauthenticated marketing surface returning a 500 because a cache is down is worse than serving an uncached result. |
| **Watch for** | A tenant-scoped query added to a scoreboard route, which would make the missing token a real hole. A third row-level-security pattern introduced by copying `is_lead_desk()` for something that is actually workspace data. And a well-meant change making the limiter fail closed "for safety". |

### LD-12: A blocked feed is not an empty result

| | |
|---|---|
| **Decision** | A data source that failed and a data source that legitimately returned nothing are distinguished everywhere, and never both reported as zero. |
| **What it means** | The scoreboard separates feed health from category quietness. Stale sources carry a staleness badge. A missing AI visibility platform is skipped rather than scored as absent. |
| **Why it's locked** | Reporting a network fault as a finding about the customer's brand is the single most damaging thing this product can do, because it is confidently wrong about the thing the customer is paying to be right about. |
| **Watch for** | A `catch` that returns an empty array, a `?? 0` on a fetch result, or an aggregate that treats a null source as a zero contribution. |

### LD-13: A scoring change stamps a formula version

| | |
|---|---|
| **Decision** | Any change to how a stored score is computed stamps a formula version on the rows it produces, and no chart crosses a version boundary without saying so. Locked 2 September 2026. |
| **What it means** | `brand_health_snapshots` rows carry `formula_version`. Rows written by the old three-component BHI are marked version 1 and are not comparable with later rows. |
| **Why it's locked** | Two BHI formulas ran concurrently for a period: a three-component version wrote the stored history while the pages computed the seven-component score live. Every trend chart spanning that period was comparing two different metrics and looked entirely plausible. |
| **Watch for** | A weight adjustment or a component added without a version stamp, because "it is only a small change to the weights". A small change to the weights is a new metric. |

### LD-14: One green, and direction is carried by glyph

| | |
|---|---|
| **Decision** | Positive is forest green at hue 110, in exactly two grounds. Ash is neutral, Flare is negative. Direction and severity are carried by glyph and label, never by hue alone. Type on a hot plane is ink. |
| **What it means** | No second green anywhere: no hover green, no chart green, no success-toast green. Success is a filled tick plus the word. Every screen must still read correctly in greyscale. |
| **Why it's locked** | The v3.4 system ran polarity on ink-to-flare specifically to avoid a green-red chart, which is unreadable for roughly one Nigerian man in twelve. That reasoning was right about green versus red and wrong about this product: ink as positive reads as absence, not approval. Green came back on terms that keep the accessibility property, which is lightness separation rather than the absence of green. Any second green breaks that property silently. |
| **Watch for** | A green added for a success state because the system's green "looks too dark for a toast". A delta coloured green to mean good. And paper text on a Flare plane, which is the instinct every single time and fails at 3.3:1. |

### LD-15: No icon library, and an icon names the thing

| | |
|---|---|
| **Decision** | The 113 drawn glyphs in `brand/icons/currentcolor` are the icon set. No library. An icon names the thing it depicts, never the abstraction. |
| **What it means** | A missing glyph gets drawn on the construction grid. `npm run icons:check` fails the build when the product asks for a glyph that does not exist. |
| **Why it's locked** | A library icon in this set is instantly visible: different stroke weight, different cap, different optical weight, rounded where nothing else is rounded. And abstraction-named icons are the specific failure that got the previous set rebuilt: three floating circles for marketplaces, a signal wave for offline attribution. |
| **Watch for** | `lucide-react` being used because it is already in `package.json` (it is, and it is imported nowhere; Doc 3 section A.4 has its removal). An inline SVG pasted for one missing glyph. An emoji used as an icon. |

### LD-16: Elevation is a hairline, and only status pills are round

| | |
|---|---|
| **Decision** | Elevation is a one-pixel hairline at `--line`. The only shadow in the system is the focus ring. `StatusPill` is the only fully-round element. |
| **What it means** | Zero box-shadows outside focus rings. A tag is square. A card is 4px, a control 3px. |
| **Why it's locked** | A shadow is what makes an interface look like a stock template, which is the one thing this identity exists to avoid. Roundness spreading is the same drift: it starts with one chip and ends with a bubbly interface that no longer reads as an instrument. |
| **Watch for** | A `shadow-sm` added to a card for "a bit of depth". `rounded-full` on a badge, a button, or an avatar frame. Both arrive in commits about something else. |

### LD-17: The needle settles, and scroll is an input only when position is the reading

| | |
|---|---|
| **Decision** | Motion represents a value changing, a state changing, or a touch being registered, and nothing else. Scroll may drive motion only when scroll position is itself the value being displayed. |
| **What it means** | No parallax, no scroll hijacking, no marquees, no counting numbers, no hover lift, nothing that loops. No `window.addEventListener('scroll')`. Only `transform` and `opacity` animate. A tick may turn about its own centre; it may not drift. |
| **Why it's locked** | The law was written for an instrument panel a signed-in user reads, and it now also governs a page a stranger scrolls, which is a different room. The loosening is narrow on purpose: position in a document is a genuine reading, and decoration that moves because the page moved is not. Losing that distinction is how the marketing site stops matching the product. |
| **Watch for** | A scroll-linked effect justified as "it is showing progress" when it is actually moving an image. Animating `width` for a bar, which forces layout on every frame. A reduced-motion check done in a hook at render time, which paints the hidden state before the query is readable. |

### LD-18: Mention text stays verbatim

| | |
|---|---|
| **Decision** | A mention is displayed exactly as written, in every language, unglossed and unitalicised. |
| **What it means** | Pidgin, Yoruba, Igbo and Hausa are not translated, not footnoted and not italicised. The interpretation lives in the sentiment classification, not in the display. |
| **Why it's locked** | This is the product telling a Nigerian marketer that their customers' language is the data, not a curiosity to be annotated for an English reader. Italicising it marks it as foreign in a product built for the market where it is native. |
| **Watch for** | A translation added "for the export" or "for the board report". An italic applied because the text is in another language and the style sheet does that automatically. A truncation that cuts mid-word. |

### LD-19: Billing is deferred, and it will be Paystack

| | |
|---|---|
| **Decision** | Billing and brand-limit enforcement are deferred until after beta, and will run on Paystack rather than Stripe. Stripe code exists, is unconfigured, and the brand limit is intentionally bypassed. |
| **What it means** | The Stripe variables should not be configured. `plan_limits` and `usage_events` collect the metering a price will need, and nothing enforces a limit today. The v6 tier prices are on record and are not a commitment. |
| **Why it's locked** | Paystack is the payment rail this market actually uses. The bypassed brand limit is a known state, and someone finding it will reasonably read it as a bug and "fix" it, cutting off existing multi-brand users. |
| **Watch for** | Brand-limit enforcement being switched on as a tidy-up. Stripe being configured because the code is there and looks nearly done. The v6 price table being quoted as though it were decided. |

---

## B.1 Decisions that are not locked, and should not be

For contrast, so the table does not swell: the chart library, the specific radius values, the
tour copy, the order of navigation items, which email provider sends, the exact wording of a
toast. These are choices with a current answer, and reversing one costs an afternoon rather
than a rebuild. They live in the design system and the build guide, not here.

The test for admission: would getting this wrong require significant rework, and is the wrong
answer the one a reasonable reviewer would suggest? If not, it is a convention, not a lock.

---

## Next actions (Doc 5)

| # | Action | Owner | By | Blocking |
|---|---|---|---|---|
| 1 | Clear the three live locked-decision violations: the Africa's Talking WhatsApp paths (LD-3), the hardcoded model ID (LD-7), and the unbranched verticals (LD-10) | Claude Code for the first two, Emmanuel decides the third | 30 Sep 2026 | Yes |
| 2 | Remove `lucide-react` so LD-15 has no loaded gun next to it | Claude Code | 30 Sep 2026 | No |
| 3 | Fold the pending design-system amendments into `brand/DESIGN-SYSTEM.md` itself, so Part A summarises a document that is current. The amendment brief is at `docs/design-system-update-brief.md` and the motion amendments at `docs/motion-amendments.md`, both still unmerged into the contract | Emmanuel and Claude Code | 15 Oct 2026 | No, but Part A is summarising a contract with known gaps until then |
| 4 | Add a locked decision whenever a market assumption is corrected, in this format, in the same session as the correction. A decision recorded a week later is a decision half-remembered | Whoever makes the correction | Ongoing | No |

*End of Document 5 of 5. End of the BrandGauge PRD set.*
