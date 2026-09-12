# BrandGauge Design System — v3.6

Drop this file at the repo root next to `brandgauge-tokens.css`. It is written to be executed, not admired. Where it says never, it means never.

**Files in this system**

| File | Role |
|---|---|
| `brandgauge-tokens.css` | The only place colour, type, space and motion values exist |
| `brandgauge-icons.svg` | 22-icon sprite, 24px grid, inline via `<use href="#bg-gauge">` |
| `gradients.css` | The two permitted gradient kinds, plus grain |
| `motion.css` | Durations, easings, the five motion behaviours, reduced-motion |
| `charts.tsx` | Seven chart forms with loading and empty states |
| `brandgauge-generative.js` | Deterministic SVG asset engine for social, OG, covers, merch |
| `brandgauge-atom.svg` | The Signal atom — the tick lifted from the logo, normalised |
| `brandgauge-logo-duotone-paper.svg` | Primary duotone mark |
| `brandgauge-logo-duotone-ink.svg` | Reversed duotone mark |
| `brandgauge-lockup-duotone.svg` | Duotone lockup, Char wordmark |
| `BRANDGAUGE-DESIGN-SYSTEM.md` | This file |

---

## 1. The one idea

BrandGauge takes readings, and the mark already describes how. Rather than redraw it, I measured it.

| Property | Value |
|---|---|
| Pivot | 448.4, 575.8 |
| Radius to tick centres | 115.5 |
| Sweep | 161.0°, from 163.3° to 2.4° |
| Angular step | 26.8° |
| Tick growth, tail to head | 0.34 → 1.00 |
| Corner radius | 24% of short side |
| Tick fill of its own step | 80% |

Three parts come out of that, and the whole system is built from them.

**The Signal.** The atom, in `brandgauge-atom.svg`. It is not a rounded rectangle that resembles the tick — it is the tick, lifted out of the drawing, de-rotated to a zero bearing and normalised to a unit box. Bullets, checkboxes, bar segments, list markers, map pins, progress. Every one is a transformed copy of that one path.

**The Crescendo.** The arc unrolled into a straight line. Meters, progress bars, sparklines. Ticks grow in *size* toward the head, which is the feature that separates this mark from every speedometer icon.

**The Needle.** Two blocks, kept exactly as drawn, in `brandgauge-needle.svg`.

They share one drawn angle of 37.25°, which means they are parallel to *each other* — unlike the ticks, which each rotate to face the pivot. The heavy block also sits 12.3 units off the pointing axis, at 89.2° to it. That offset is hand-set and it is what stops the mark reading as a stock speedometer.

Draw it as one rigid object with the pivot at the origin:

```
translate(cx, cy) rotate(-(angle - 65.85)) scale(R / 115.5)
```

Never decompose it into parts and re-rotate each by its own bearing from the pivot. Doing so throws the two blocks 89° out of parallel and loses the offset. One needle per surface.

**The test that proves it holds.** `render({mode:'sweep', signals:[100], n:7})` returns the logo. If it ever stops doing that, the engine has drifted and the engine is wrong, not the drawing.

**Two things v3.0 got wrong here.** The arc was drawn with stroked lines at constant width, which threw away both the atom's geometry and the size crescendo. And tick size was set independently of tick count, so above about ten ticks the atoms overlapped into a solid worm. Size now derives from the step chord, so gaps hold at any density.

## 2. Colour

Direction A, expanded. Four warm steps, three neutrals, and no colour outside this file.

```
Ground   Ink #16120E   Paper #FAF6EF   Shell #F1ECE2   Ash #8C877E
Ramp     Char #5A1E0C  →  Danfo #FFC12E  →  Ember #FF9E1B  →  Flare #FF3D14
Support  Flare pressed #D62E0B   Flare wash #FFE9E3
```

### The ramp is a fire, read cold to hot

Char is spent charcoal. Ember is the coal still glowing. Flare is the flame. Danfo is the brightest yellow at the top of it. One sequence rather than four separate stories, and in Lagos it sits on every street corner between the suya grill and the bus.

That grounding is deliberately at the level of the system, not the swatch. No single colour here is asked to carry folklore on its own, which is the trap the first palette fell into with "Aro Blue."

It also does a job. A gauge runs cold to hot, so the ramp and the reading are the same scale. A tick low on the arc is Danfo, a tick at the head is Flare, and a chart legend needs no explanation.

**Char is a shade, not a new hue.** `#FF3D14` multiplied down to roughly 35% is `#591507`; Char is that, warmed slightly. Because it descends from the hero it never fights it, and at 12:1 on Paper it is the accessible way to set Flare as text. It replaces the old `--flare-deep` token entirely.

**Danfo is a tint of Ember**, not a fifth colour. It exists so the crescendo has somewhere light to start on both grounds.

### The ratio, enforced

| Layer | Share of any surface | What it is |
|---|---|---|
| Ground | ~75% | Paper or Ink, plus text and hairlines |
| Hero | ~20% | Flare, applied to whole planes |
| Ramp + polarity | ~5% | Data only, never chrome |

### The mark is duotone, and the duotone is the crescendo

The ticks already grow in size from tail to head. They now grade in colour along the same path, Danfo through Ember into Flare, so the crescendo is carried twice and survives distance, small size and greyscale conversion. The needle is Char, the one dark object in the mark, which is what makes the eye land on the reading rather than the arc. Reversed on Ink, the needle flips to Paper so it stays the extreme-contrast element.

Grading a seven-tick arc, tail to head: `#FFC12E #FFB528 #FFAA21 #FF9E1B #FF7E19 #FF5D16 #FF3D14`.

**Where the duotone is not allowed.** Below 24px, in single-colour print, embroidery or engraving, and anywhere the mark sits on a background that is itself in the ramp. Then it is mono, in Ink or Paper. Seven graded ticks at favicon size turn into mud.

### Six rules that keep it clean

1. **One hero per frame.** A screen, a poster, a slide, a story. Flare appears once as a plane, not four times as accents.
2. **Flare fills, it does not outline.** No 1px Flare borders, no Flare underlines, no Flare icon strokes on a Paper ground.
3. **Flare is never body text.** `#FF3D14` on `#FAF6EF` sits at 3.1:1. Display type at 24px and above, or use `--tx-flare` (`#9E1F05`) which clears 7:1.
4. **No gradients.** Not in the brand, not in charts, not on hover. If you need a scale, use the five ramp steps.
5. **The ramp grades, it never mixes.** Danfo, Ember and Flare only ever appear as ordered steps along a crescendo, an arc, a lane or a ring. Three warm colours scattered at equal weight across one frame is the chaos case; the same three as a graded sequence is the system working. Ember and Danfo can carry a secondary plane, but never next to a Flare plane of similar size.
6. **Never two brights at equal size in one frame,** with one exception: the ramp inside a chart, where the steps are ordered rather than competing.

### Polarity, and the green question

v3.4 ran polarity on an ink-to-flare axis because a green-red sentiment chart
is unreadable for roughly 1 in 12 Nigerian men. That reasoning was sound about
green-versus-red; it was wrong about this product. Ink as "positive" reads as
absence rather than approval, and a sentiment score in black beside a score in
orange tells a marketer nothing at a glance. Positive is green again, chosen so
the accessibility argument still holds:

```
positive / nominal   --pos   #345C2C   forest, hue 110      light
                             #9BC98A   the same hue on Ink  dark
neutral              --neu   #8C877E   ash
negative / alert     --neg   #FF3D14   flare
```

**Hue 110, not 140.** It leans olive rather than emerald, so it sits with the
warm ramp instead of fighting it. 7.2:1 on Paper, 7.7:1 on a white card,
9.9:1 on Ink.

**Why this survives colour blindness.** The green is dark (relative luminance
0.086) and Flare is bright (0.246). Positive and negative are therefore 2.2:1
apart in lightness alone, and stay 2.3:1 apart under a deuteranope simulation.
The pair is separable without hue, which is the property that mattered — not
the absence of green itself.

**The weak pair is neutral against negative,** not positive against negative:
ash sits at 0.244 and Flare at 0.246, near-identical in lightness, so those two
are told apart by hue alone. Where that distinction carries meaning, give it a
glyph or a label as well.

**Direction is carried by glyph, not colour.** `CAC ₦412 ▼ 9%` is good news and the arrow says so. Never colour a delta green to mean good.

**The trade-off, stated plainly:** you lose the instant convention of a green tick on success toasts. Mitigation is a filled tick glyph plus the word. `Connected` with a solid ink tick reads correctly and does not need a hue.

---

## 3. Type

Nohemi only, plus a mono for numerals.

### Four weights exist. Only four.

`brand/fonts.css` loads Nohemi at **400, 500, 700 and 800**, and Disket Mono at
**400 and 700**. Nothing else is supplied, so nothing else can be specified.
Asking for a weight that has no file does not fail loudly, it silently resolves
to a neighbour, which is how this table came to name three weights that never
rendered. Measured in the browser at 64px:

| Asked for | Renders as | Evidence |
|---|---|---|
| 600 semibold | **700** | identical width to 700, 469.59px |
| 900 black | **800** | identical width to 800, 473.22px |
| mono 500 | 400 | no 500 file for Disket |

So `font-semibold` and `font-bold` are the same thing across this product, and
`font-black` and `font-extrabold` are the same thing. Either supply the files or
stop naming the weights. Until a 600 lands, write 500 or 700 and mean it.

### The table, as it actually is

| Role | Size | Weight | Tracking | Leading |
|---|---|---|---|---|
| Display | `--t-display` | 700 | -0.03em | 1.0 |
| H1 | `--t-h1` | 700 | -0.03em | 1.05 |
| H2 | `--t-h2` | 700 | -0.02em | 1.06 |
| H3 | 21px | 500 | -0.02em | 1.15 |
| Body | 17px | 400 | 0 | 1.55 |
| Small | 14px | 400 | 0 | 1.5 |
| Micro | 12px | 500 | 0.01em | 1.45 |
| Readout | `--t-readout` | mono 400 | -0.03em | 1.0 |

**700 is the heaviest weight that ships.** 800 was the display weight and it was
too much: at 56px with -0.03em tracking the counters close up and the line reads
as a wall rather than a sentence. Hierarchy comes from size and tracking, which
is where it belongs. 800 is now reserved for a single numeral inside an
illustrative scene, and if it stops being used there it should be dropped from
`fonts.css` and the payload with it.

**Mono has exactly one job: numerals.** Scores, currency, percentages, counts, timestamps, ASCII meters, code. Always `font-variant-numeric: tabular-nums` so digits do not jitter as data updates.

**Mono is never used for labels, eyebrows, captions, nav or UI text.** That habit is the single most common tell of a templated product page, and the current site does it on every section marker.

**No all-caps.** Not for eyebrows, not for labels, not for buttons. Sentence case everywhere. If a label needs to recede, use `--tx-3` at 12px, not capitals.

**No middle-dot meta strings.** `Brand intelligence · Lagos to Accra` becomes a sentence or it goes.

Body copy caps at 68 characters per line.

---

## 4. Layout — the ruler grid

12 columns, 24px gutters, 1260px max, left-aligned. Nothing is centred except a genuinely symmetrical object like the gauge itself.

**Sections are separated by a tick rule, not a hairline.** A row of 7×16px ticks at `--tick-1`, repeated across the full width. This is the one piece of decoration in the system and it earns its place because it is the logo's own material.

```css
.rule-tick {
  height: 16px;
  background-image: repeating-linear-gradient(
    to right, var(--tick-1) 0 7px, transparent 7px 22px);
  border-radius: 0;
}
```

**Vertical rhythm is 8px.** Section padding is `--s-10` (130px) on desktop, `--s-8` on mobile. Card padding is `--s-5`.

**Radius discipline.** Cards 4px, controls 3px, ticks 2.5px, status pills fully round. Nothing else is rounded. Do not put one radius on everything, which is what the SaaS-card kit does and why it looks like every other dashboard.

**Elevation is drawn, not shadowed.** One hairline `--line`, no box-shadows anywhere except a focus ring. Instruments are engraved.

---

## 5. Backgrounds and patterns

Four patterns. All are built from ticks. All are single-hue.

| Name | Construction | Where |
|---|---|---|
| Tick field | 22px grid, 3.5×11px ticks at `--tick-1`, density varies by data | Section backgrounds, empty states, merch |
| Sweep | 56 ticks along a 180° arc, faint to solid | Hero, loading, report covers |
| Ridge | Horizontal lanes of ticks, one lane per signal | Report covers, OG images |
| Ruled shell | `--bg-shell` with a 4px baseline tick every 24px down the left edge | Data tables, sidebars, code blocks |

**Never** use a pattern behind body text. Patterns sit behind display type, behind a card, or alone.

---

## 6. ASCII — yes, and it is not a gimmick

BrandGauge sends a Monday briefing, monthly reports and Slack digests. Those land in plain text, and a brand that abandons its identity the moment it hits a monospace context is not a system. Ship this:

```
BRANDGAUGE  ·  PocketPay  ·  wk 37

Brand Health Index
72 / 100   ▁▂▃▄▅▆▇█▇▆  ▲ 4

Sentiment   78  ████████████████░░░░
Share of voice  64  █████████████░░░░░░░
Survey      71  ██████████████░░░░░░
Funnel      55  ███████████░░░░░░░░░
Offline     41  ████████░░░░░░░░░░░░

Negative spike  Kano, Tue  ·  62% Hausa  ·  "ba ya aiki"
```

Rules: 20-cell meters, `█` filled and `░` empty, values right-aligned in a 3-char field, the header line never wider than 62 characters so it survives Gmail on a phone. The sparkline uses `▁▂▃▄▅▆▇█` only.

This same grammar gives you a CLI, a plain-text export, an email footer signature and a terminal-flavoured merch print that is actually the product rather than a joke.

---

---

## 5b. Gradients

Two kinds. Nothing between them.

**Quantised.** Made of atoms, so you can count it. Every crescendo, arc, ridge and column is a quantised gradient. This is the primary form.

**Atmospheric.** A soft radial wash on a dark ground carrying no information, used to give a chapter temperature.

| Token | Build | Where |
|---|---|---|
| `--grad-hearth` | radial, Char into Ink | Default dark chapter |
| `--grad-forge` | radial, Flare through Char into Ink | High intensity only. Film, launch, a record reading |
| `--grad-dawn` | radial, Danfo and Ember at 14% into transparent | Empty states, onboarding, low signal |
| `--grad-scrim` | linear, Ink 0 to 94% | The only linear gradient permitted, and it is functional: legibility over photography |
| `.bg-bloom` | data-driven radial, radius and opacity from `--bloom` | Behind a live reading |

**Bloom is the interesting one.** Set `--bloom` from the reading (0 to 1) and the glow grows with it, so even the soft light on the screen is a measurement rather than decoration. That is the test any new gradient has to pass.

**Grain is mandatory on every atmospheric gradient.** Wide radials band visibly on 8-bit displays and noise is the fix. It also stops the ground reading as flat vector, which is what makes a dark gradient look cheap. Fixed, `pointer-events: none`, never on a scrolling container.

**Banned.** Linear fills on buttons, cards, chips, chart bars or text. Gradient borders and gradient text. Any gradient on Paper. Any gradient crossing outside the ramp. A gradient behind body copy. Two-stop 45° fades of any kind.

---

## 5c. Charts — two tiers

Novelty in an encoding is a tax the reader pays every time they look at it. A countable tick bar is defensible in a hero shot and hostile in a Tuesday-morning dashboard with twelve panels. So the chart system splits.

### Tier 1 — Instrument. The default.

`HeatLine`, `HeatBars`. Shapes people already know how to read: a line with an area fill, axes, horizontal gridlines, value labels, a called-out latest reading.

The brand lives in the **colour encoding**, not the geometry. Heat runs vertically with value, so a climbing line heats up: cool at the bottom of the domain, Flare at the top. The atom appears only as the point marker, which is the one place a fingerprint costs the reader nothing.

Almost everything in the product should be Tier 1.

### Tier 2 — Expressive.

`ColumnChart`, `TrendChart`, `FunnelChart`, `DistributionChart`, `RingChart`, plus the sweep, ridge, core and field patterns. Unmistakable, and slower to read.

They belong where the picture is the message: the gauge itself, report covers, social, out-of-home, empty states, a single hero panel.

### The rule

If the reader has to extract a number or compare quantities to make a decision, **Tier 1**. If the reader has to feel a state, **Tier 2**. Never put a Tier 2 chart in a dashboard panel beside more than one other chart.

### Heat means one thing everywhere

High on the gauge, high on a line, high on a bar. Value, vertically, always. If heat meant "recent" on a trend and "high" on a dial, that is two meanings and the system breaks.

### Colour discipline in charts

Only the subject series gets heat. Comparison series are neutral: ink at 30% opacity, dashed for lines, muted fill for bars. This is what stops a multi-series chart turning into a rainbow, and it means the reader's eye lands on yours without a legend.

### Every chart ships with three states

Success, loading and empty. A chart with only a success state is half a component. Loading is a skeleton shaped like the chart that is coming, so the layout never jumps — never a spinner. Empty states name the next action; they never just say no data.

## 5d. Motion

One law: **the needle settles, nothing bounces.** Motion is an instrument responding, never an interface showing off. If an animation does not represent a value changing, a state changing, or a touch being registered, it does not ship.

| Event | Duration | Easing |
|---|---|---|
| Tick lighting | 90ms | snap |
| Stagger, per tick or row | 40ms | — |
| Needle travel | 620ms | settle |
| Crescendo climbing | 900ms cap | settle |
| Press feedback | 110ms | snap |
| UI state | 180ms | snap |
| Panel, sheet, drawer | 420ms | glide |
| Page transition | none | — |

```
--ease-settle: cubic-bezier(.16,.84,.28,1)   value change, needle
--ease-snap:   cubic-bezier(.4,0,.2,1)       UI state, press, toggle
--ease-glide:  cubic-bezier(.32,.72,0,1)     panels, sheets, overlays
```

**The signature motion is a value changing.** Ticks re-light in sequence, the needle travels and settles with a 3% overshoot. It is the only motion that fires without a user action, and only when the number actually moved.

**Only `transform` and `opacity` are animated.** Never `top`, `left`, `width`, `height`.

**Banned, and each has been tried.** Parallax and scroll hijacking. Marquee and infinite logo strips. Numbers counting up on scroll, because the reading is not a slot machine. Hover lift on cards, since nothing here floats. Fade-and-slide-up on every element — one reveal group per section, maximum. And `window.addEventListener('scroll')`, which is a hard ban rather than a preference: use IntersectionObserver or `animation-timeline: view()`.

`prefers-reduced-motion` collapses all of it to final states on load.

---

## 6b. Photography

A cultural intelligence tool has to look at the culture. Three treatments, and choosing between them is a decision about what kind of claim the image is making.

| Treatment | Build | Use |
|---|---|---|
| Ink duotone | shadows `#16120E`, highlights `#FAF6EF` | Digital stories, anything where the claim is a number. The image recedes so the reading is loudest. |
| Flare duotone | shadows `#9E1F05`, highlights `#FFE9E3` | Street stories. Offline attribution, OOH, field activations. Signal that came from outside a screen. |
| Full colour | untreated | People, as they are. Field documentation, ambassador content, team and customer photography. |

**People are never duotoned.** Putting a filter on somebody's face to make it match a palette is the wrong instinct for this brand.

Duotone is an SVG filter, not a Photoshop step, so it applies live in product:

```html
<filter id="duoInk" color-interpolation-filters="sRGB">
  <feColorMatrix type="matrix" values="0.34 0.5 0.16 0 0  0.34 0.5 0.16 0 0
                                       0.34 0.5 0.16 0 0  0 0 0 1 0"/>
  <feComponentTransfer>
    <feFuncR type="table" tableValues="0.086 0.980"/>
    <feFuncG type="table" tableValues="0.071 0.965"/>
    <feFuncB type="table" tableValues="0.055 0.937"/>
  </feComponentTransfer>
</filter>
```

### The Reading Strip

Wherever a photograph appears, it carries a strip across the bottom: the number, the place, and how many sources it came from.

```
72   Balogun, Lagos Island · Tuesday          1,204 mentions · 4 languages
```

Ink ground, Paper number in mono at 17px, place in `--tx-inv-2` at 12px, sources right-aligned. This is the rule that stops any image in this brand from being decoration. **If a picture cannot carry a reading, it does not go out.**

### Needle pins

Annotations on photography are the atom, rotated, with a Flare label. They show the product doing its work inside the brand's own pictures. Maximum two per image.

## 7. Icons

22 icons in `brandgauge-icons.svg`, drawn on a 24px grid with a 20px live area, 1.75px stroke, butt caps, miter joins.

**The rule the last set broke:** an icon names the thing, never the abstraction. Marketplaces is a market stall canopy, not three floating circles. Offline attribution is a billboard on two posts, not a signal wave. If someone has to read the label to know what the icon means, redraw it.

### The construction template

Copy this into any new icon file and draw inside it. Delete the guide layer before export.

```svg
<svg viewBox="0 0 24 24" width="240" height="240">
  <g stroke="#FF3D14" stroke-opacity=".35" stroke-width=".1">
    <rect x="2" y="2" width="20" height="20" fill="none"/>       <!-- live area -->
    <rect x="4" y="2" width="16" height="20" fill="none"/>       <!-- portrait key -->
    <rect x="2" y="4" width="20" height="16" fill="none"/>       <!-- landscape key -->
    <circle cx="12" cy="12" r="10" fill="none"/>                 <!-- circle key -->
    <path d="M2 12h20M12 2v20M2 2l20 20M22 2L2 22" fill="none"/> <!-- axes -->
  </g>
  <g id="glyph" fill="none" stroke="#16120E" stroke-width="1.75"
     stroke-linecap="butt" stroke-linejoin="miter">
    <!-- draw here -->
  </g>
</svg>
```

Constraints: strokes land on whole or half pixels. Curves use r=2, r=2.5, r=6.5 or r=7 and nothing between. Diagonals are 45° or 2:1. Optical weight is matched to `bg-gauge`, which is the reference glyph.

Icons are `--tx` or `--tx-3`. An icon is Flare only when it is the single hero element of a card, and then it is a filled tick shape rather than a stroke.

### The set

`bg-gauge` `bg-mentions` `bg-funnel` `bg-ooh` `bg-survey` `bg-share` `bg-field` `bg-creative` `bg-ask` `bg-connect` `bg-trend` `bg-alert` `bg-export` `bg-filter` `bg-search` `bg-shelf` `bg-card` `bg-venue` `bg-saas` `bg-market` `bg-bottle` `bg-truck`

The last seven map one-to-one to the seven industries: FMCG, fintech, venues, B2B SaaS, marketplaces, beverage, distribution.

---

## 8. Motion

One law: **the needle settles, nothing bounces.**

| Event | Duration | Easing |
|---|---|---|
| A tick lighting | 90ms | `--ease-snap` |
| Arc filling | 40ms stagger per tick, capped at 900ms total | `--ease-snap` |
| Needle travel | 620ms | `--ease-settle` |
| UI state change | 180ms | `--ease-snap` |
| Page transition | none | — |

The Brand Health Index is the only element allowed a non-user-triggered animation, and only on first paint: ticks light left to right, the needle overshoots by 3% and settles. Once per session. Never on scroll.

**Banned:** fade-and-slide-up on section entry, hover lift on cards, parallax, marquee logo strips, counting-up numbers on scroll, anything that loops.

`prefers-reduced-motion` renders every final state immediately.

---

## 9. Component contracts

These are the components the app already needs. Build them once.

**`<Gauge value trend />`** — the arc, 56 ticks, needle, readout in mono. Sizes: 320 (dashboard), 160 (card), 44 (nav badge). Below 160 the ticks drop to 28 and the readout goes inside.

**`<Meter label value />`** — a horizontal tick bar, 20 segments, lit segments at `--tick-5`, unlit at `--tick-1`, mono value right-aligned. This is the workhorse. Sentiment, SOV, survey, industry weights all use it.

**`<Funnel stages />`** — stacked bands, width proportional to volume, ink fill, Flare on the stage currently selected. Never a gradient down the funnel.

**`<MentionCard text language platform aspect />`** — the mention verbatim at 17px, never truncated mid-word, with a language chip in `--bg-shell` and a polarity tick in `--pos` / `--neu` / `--neg`. The Pidgin and Yoruba stay untranslated and unitalicised. That is a brand decision, not an oversight.

**`<Delta value direction good />`** — mono value, `▲` or `▼`, colour always `--tx-2`. The arrow carries the meaning.

**`<Readout label value unit />`** — mono tabular, label above at 12px `--tx-3`, value at `--t-readout`.

**`<StatusPill state />`** — the only fully-round element in the system. `live` gets a filled Flare tick, `paused` an ash tick, `error` a Flare fill with Paper text.

**`<AskBar />`** — the AI command layer. The `bg-ask` chevron, a text field with a blinking tick as the cursor rather than a bar, and answers arriving as numbered claims with a source line. No chat bubbles, no avatar, no typing dots.

---

## 10. Voice in the interface

Sentence case. Active voice. The button says what happens.

The product speaks like a colleague who has read the numbers. `Sentiment fell 4 points in Kano on Tuesday` beats `Anomaly detected in regional sentiment metrics`.

Naija texture stays where it belongs: inside customer mentions, verbatim, unglossed. The interface itself does not perform Nigerianness. It is built here, it does not need to say so on every screen.

Empty states name the next action: `Connect Meta Ads to see your first sentiment reading`. Errors say what happened and what to do, and they do not apologise.

---

## 11. Rehaul sequence

For the agent doing the pass, in this order. Do not skip ahead, because each step removes work from the next.

1. **Drop in `brandgauge-tokens.css`, delete every hardcoded colour** in the codebase. Grep for `#`, `rgb(`, `hsl(`. Zero exceptions.
2. **Kill the blue.** `#2B59FF` and every tint of it. Semantic replacements: primary action → `--flare`, link → `--tx-flare`, info → `--tx-2`.
3. **Green is `--pos` only.** Success → a filled tick plus the word. Positive sentiment → `--pos`. Never a second green, and never green as a chart series.
4. **Strip mono off every non-numeric string.** Eyebrows, nav, captions, section markers, chips.
5. **Remove all-caps and letter-spacing from labels.** Sentence case, 12px, `--tx-3`.
6. **Replace every shadow with a hairline.** Search `box-shadow`, keep only focus rings.
7. **Normalise radius** to 4 / 3 / 2.5 / pill. Nothing else.
8. **Swap the icon set** for the sprite. Any icon without a match gets drawn on the template in section 7, not substituted from a library.
9. **Rebuild the eight components** in section 9 and replace their ad-hoc instances.
10. **Delete section-entry animations.** Keep only the gauge first-paint sequence.
11. **Run the audit** in section 12.

---

## 12. Ship audit

A screen ships when all of these are true.

- One hero plane. Count the Flare regions: if more than one, cut.
- No Flare text under 24px anywhere.
- Every number is mono and tabular. Every non-number is not.
- No capitals except proper nouns and the start of sentences.
- Zero box-shadows outside focus rings.
- Keyboard focus visible on every interactive element, 2px `--flare` ring at 2px offset.
- Body text passes 7:1. Large text and UI passes 4.5:1.
- The screen still reads correctly in greyscale. If meaning disappears, colour was doing a job a glyph should be doing.
- Reduced-motion renders every final state on load.
- Nothing on the screen would look at home in a stock dashboard template.
- Every gradient is either quantised or atmospheric. No linear fills on components.
- Every atmospheric gradient carries grain.
- Every chart has a loading state and an empty state, and the skeleton matches the chart's shape.
- Every chart a reader uses to extract a number or compare quantities is Tier 1. No Tier 2 chart sits in a panel beside more than one other chart.
- Only the subject series carries heat. Comparison series are neutral.
- No animation touches `top`, `left`, `width` or `height`.
- No `window.addEventListener('scroll')` anywhere in the codebase.
- At most one reveal group per section.
- The ramp is never muted and Char is never the dominant surface. Both are what keep this palette out of the warm-cream-and-clay family that reads as a template.

---

## Next actions

| # | Action | Owner | Blocking |
|---|---|---|---|
| 1 | Confirm the ink-versus-flare polarity call replaces green in the product, not just in brand | Emmanuel | Yes, gates step 3 |
| 2 | Supply Nohemi web files (woff2) for the app repo; the brand world has them embedded, the app does not | Emmanuel | Yes, gates step 1 |
| 3 | Confirm mono family. Geist Mono is in use; it pairs well and has proper tabular figures | Emmanuel | No |
| 4 | Run the generative engine against a real workspace's five signals and judge the output | Claude Code | No |
| 5 | Draw industry icons 8 onward if the industry list grows past seven | — | No |
| 6 | Decide whether the OOH vanity-link sticker carries the arc or the wordmark at 300mm | Emmanuel | No |
