# Update brief for the design-system chat

Paste the block below into the chat that produced `brand/DESIGN-SYSTEM.md`. It is
written to stand on its own: that chat cannot see this repo, so every value,
every measurement and every reason is stated here. It is ordered by section so
the artifact can be patched section by section rather than regenerated.

---

## Paste from here

The design system has been in production for a while now and the code has moved
ahead of the document in eleven commits. Please update the artifact with the
changes below. They are grouped by your own section numbering. Most are
amendments; three are contradictions inside the current artifact that need a
decision, and those are listed last.

Keep the document's existing voice and structure. Keep the reasoning: the thing
that makes this document useful is that it says why, not just what. Every value
below was measured in a browser, not chosen by eye, and where a number is a
contrast ratio it is a real measurement against the real ground.

---

### Section 2, Colour

**1. A new token: `--on-hot`.**

```
--on-hot:  #16120E   /* type on a Flare, Ember or Danfo plane */
```

Reason: the artifact says type on a hot plane is Paper. Measured, Paper on Flare
is 3.3:1, which fails. Ink on Flare is 5.3:1, which passes the large-text and UI
bar. So a hot plane carries ink, not paper. This inverts one of the original
rules and it needs stating explicitly, because the instinct is always the other
way round.

Please add a line to the six rules that keep it clean: **type on a hot plane is
`--on-hot`, never Paper.** In dark mode `--on-hot` does not change: Flare is
bright on both grounds, so ink stays the right answer.

**2. The text ramp was reset, because two of its three steps were failing.**

Old, with measured ratios on Paper:

```
--tx     #16120E   17.3:1   passed
--tx-2   #5B554D    6.1:1   failed the 7:1 body bar
--tx-3   #8C877E    3.3:1   failed both bars on every ground
```

New:

```
--tx     #16120E   17.3:1 on Paper
--tx-2   #44403B    9.5:1 on Paper, 8.7:1 on Shell
--tx-3   #4F4B46    8.0:1 on Paper, 7.4:1 on Shell
```

Please replace the ramp and add the reasoning, which is a real change of
principle: **the steps below Ink are Ink lightened toward Paper. They are shades
of the ground, not new hues, and all three clear 7:1 on every ground in the
system.** Hierarchy in type is carried by size and weight, not by fading text
out until it stops being readable. The old ramp was doing hierarchy with
opacity, which is why the bottom of it was illegible.

Consequence worth its own line: **Ash (`#8C877E`) is no longer a text colour.**
At 3.3:1 it could not pass either bar on any ground here. It keeps its other two
jobs, where it is a mark rather than type: `--neu` for neutral polarity, and the
unlit ticks. If the document currently offers ash as the receding text step,
that sentence has to go.

Also add `--tx-inv-2: #A9A299` (7.4:1 on Ink), which is the caption step on a
permanent ink plane. The Reading Strip in section 6b already names this colour;
it now has a token.

**3. The dark ramp was reset for the same reason, and harder.**

```
old   --tx-2  #A9A299      --tx-3  #6F6A62   (the second one is near-invisible)
new   --tx-2  #CCC8C2      11.2:1 on Ink, 10.0:1 on the raised card
      --tx-3  #C1BDB7      10.0:1 on Ink,  8.9:1 on the raised card
```

The dark card is `#221D18`, only a step off the ink ground, so anything that
merely passed on Ink failed on the card. Both dark steps are now set against the
card, not the ground. Please state that as the rule: **in dark mode the
contrast bar is measured against the raised card, not the page.**

**4. Positive is green again.** This reverses the v3.4 polarity call and it is
the largest change in the set, so it needs the full argument, not just the
value.

```
positive / nominal   --pos   #345C2C   forest, hue 110      light ground
                             #9BC98A   the same hue lifted  dark ground
neutral              --neu   #8C877E   ash
negative / alert     --neg   #FF3D14   flare
```

The v3.4 reasoning was that a green-red sentiment chart is unreadable for
roughly one Nigerian man in twelve. That reasoning was sound about green versus
red. It was wrong about this product. Ink as positive reads as absence rather
than approval, and a sentiment score in black beside a score in orange tells a
marketer nothing at a glance.

Green is back, chosen so the accessibility argument still holds:

- **Hue 110, not 140.** It leans olive rather than emerald, so it sits with the
  warm ramp instead of fighting it. 7.2:1 on Paper, 7.7:1 on a white card,
  9.9:1 on Ink.
- **Why it survives colour blindness.** The green is dark, relative luminance
  0.086, and Flare is bright, 0.246. Positive and negative are therefore 2.2:1
  apart in lightness alone, and stay 2.3:1 apart under a deuteranope
  simulation. The pair is separable without hue at all, which is the property
  that actually mattered. The absence of green was never the point.
- **The weak pair is neutral against negative, not positive against negative.**
  Ash sits at 0.244 and Flare at 0.246, near-identical in lightness, so those
  two are told apart by hue alone. Where that distinction carries meaning, give
  it a glyph or a label as well.
- **Never a second green.** One green exists, in two grounds. A hover green, a
  chart green or a success-toast green is a new hue and is not allowed.
- **Direction is still carried by glyph, not colour.** `CAC ₦412 down 9%` is
  good news and the glyph says so. Never colour a delta green to mean good.
- The trade-off, stated plainly: success is a filled tick plus the word, never a
  hue on its own.

**5. One stale comment to fix.** `brand/tokens.css` still carries the header
`/* Polarity. There is no green in this system. Deviation runs hot. */`
immediately above a forest-green `--pos`. If the artifact carries that sentence
anywhere, it is now false and should read something closer to *one green, hue
110, in two grounds; deviation still runs hot.*

---

### Section 3, Type

**1. Four weights exist, and three of the ones the table named never rendered.**

`brand/fonts.css` loads Nohemi at 400, 500, 700 and 800, and Disket Mono at 400
and 700. Nothing else is supplied, so nothing else can be specified. Asking for
a weight with no file does not fail loudly, it silently resolves to a neighbour.
Measured in the browser at 64px:

| Asked for | Renders as | Evidence |
|---|---|---|
| 600 semibold | 700 | identical width to 700, 469.59px |
| 900 black | 800 | identical width to 800, 473.22px |
| mono 500 | 400 | no 500 file for Disket |

So `font-semibold` and `font-bold` are the same thing in this product, and
`font-black` and `font-extrabold` are the same thing. Please add this table and
the rule: **either supply the files or stop naming the weights.**

**2. Every heading is 500. One weight, all of them, app and marketing.**

The type table now reads:

| Role | Size | Weight | Tracking | Leading |
|---|---|---|---|---|
| Display | `--t-display` | 500 | -0.03em | 1.0 |
| H1 | `--t-h1` | 500 | -0.03em | 1.05 |
| H2 | `--t-h2` | 500 | -0.02em | 1.06 |
| H3 | 21px | 500 | -0.02em | 1.15 |
| Body | 17px | 400 | 0 | 1.55 |
| Small | 14px | 400 | 0 | 1.5 |
| Micro | 12px | 500 | 0.01em | 1.45 |
| Readout | `--t-readout` | mono 400 | -0.03em | 1.0 |

800 was the display weight and it was too much: at 56px with -0.03em tracking
the counters close up and the line reads as a wall rather than a sentence. 700
was better and still heavy. 500 is the step that reads clean, and hierarchy
comes from size and tracking, which is where it belongs. 600 would have been the
natural heading weight and there is no file for it. 800 is now left on a single
numeral inside an illustrative scene; if that goes, the file leaves `fonts.css`
and the payload with it.

**3. A new rule the document was missing: what 700 is for.**

Weight carries one job here and it is not hierarchy. Weight says *this is
actionable*, or *this is the number*. So 700 is allowed in exactly three places:

1. **Anything you press.** Buttons, the primary call to action, a chip that
   toggles. A control at 500 stops reading as pressable.
2. **A numeral that is the reading.** A score, a delta, a metric value, the
   figure in a readout. This is the type side of *heat means value*.
3. **At most one phrase per paragraph** of body copy, where a sentence turns on
   a specific claim. One per paragraph, and often none.

And never to make a heading louder. A heading that needs more presence needs a
bigger size, not a heavier face.

**One marker per emphasis.** The trap is double-marking: an accent word in a
hero is already Danfo-coloured, so setting it 700 as well says the same thing
twice and the line goes lumpy. Colour or weight, not both.

---

### Sections 5d and 8, Motion

**1. There are two motion sections and they disagree. Delete section 8, keep 5d.**

Section 5d says the needle animation is the only motion that fires without a
user action, and only when the number moved. Section 8 says the Brand Health
Index is the only element allowed a non-user-triggered animation, never on
scroll. 5d carries three table rows that 8 does not; 8 states the 900ms arc cap
differently. Anyone reading top to bottom hits 5d and never learns 8 exists. Fold
8's one unique sentence about the Index into 5d and delete 8. A rule that appears
twice is a rule that will drift.

**2. Scroll may be the input when the reading is the output.** This is the real
amendment, and it loosens a hard ban, so please carry the argument.

The current ban is aimed at a genuine failure, and the failure is not scroll as
an input. It is decoration that moves because the page moved: parallax, elements
drifting at different rates, per-frame main-thread work for no informational
gain. Position in a document is a genuine reading, and this brand's whole
vocabulary is for displaying readings. Proposed wording:

> Scroll may drive motion only when scroll position is itself the value being
> displayed. A progress reading, a rail, a crescendo, a section arriving. It may
> never drive decoration: nothing moves at a different rate from the page, and
> nothing changes size, blur, colour or position merely because the page moved.
>
> Where scroll is the input it must be smoothed. A raw scroll value applied
> straight to a tick makes it flicker on and off at the boundary on a trackpad.
> Pass it through a spring.
>
> The prohibition on `window.addEventListener('scroll')` stands as a
> prohibition on hand-rolled per-frame scroll work. Use IntersectionObserver,
> `animation-timeline: view()`, or a scroll motion value from the motion library
> (`useScroll` with `useSpring`), which is passive and frame-scheduled. An
> element reporting its own `scrollLeft` through an `onScroll` handler is that
> control doing its job, not a page effect, and is allowed. Throttle it to one
> frame.

**3. Heat spreads across the lit run. It is never measured back from the head.**
Not stated anywhere today; it was assumed, and the assumption cost a rebuild. The
first reading rail coloured each lit tick by how far back it sat from the head,
so past four ticks everything fell onto `--tick-1`, the track colour. Twenty-four
of twenty-eight lit ticks rendered as unlit and it read as a small blob sliding
down the gutter. Proposed wording:

> A lit run carries the ramp across its whole length, from `--tick-2` at the tail
> to `--flare` at the head, rescaled every time the run grows. Heat is never a
> function of distance from the head, because that leaves a long run mostly in
> track colour and destroys the one thing the graphic is for.

**4. Density is a reading, and overlap is how it is drawn.** `GEOM.fill` is
documented as the share of the chord a tick occupies, with below 1 standing the
ticks apart. Above 1 was undefined, and above 1 turns out to be the most useful
discovery of the whole pass. The hero photograph now arrives through the mark's
arc used as a mask at `fill: 1.35`. Because tick size already grows toward the
head, an overlap above 1 makes the apertures meet unevenly: the cold end stays
discrete and the hot end coalesces into a single mass. The picture is denser
exactly where the gauge would be hotter. Proposed wording:

> `fill` below 1 stands the ticks apart and reads as a dial. That is the default
> and it is correct for any instrument.
>
> `fill` above 1 is reserved for the arc used as a mask or a field, where the
> ticks are apertures rather than marks. The overlap resolves unevenly along the
> growth curve, so the run reads discrete at the tail and solid at the head.
> Density is then the reading, performed by whatever shows through rather than
> drawn beside it. Do not use it on an arc that is displaying a number: two
> readings in one graphic is one too many.

**5. Tick count is seven, and more is not more.** `GEOM.ticks: 7` is in the
engine and nothing said a consumer may not pick its own count. The first mask
used twenty-two to twenty-eight on the theory that a photograph needs more
apertures. Backwards: more ticks makes each window smaller, and at twenty-two a
market street came out as confetti. At seven the head aperture is about a fifth
of the frame, which holds a readable slice.

> Seven is the mark's count and the default everywhere. Raise it only where the
> ticks are marks on a scale and the scale is genuinely finer, such as a long-run
> progress rail, and never where something has to be legible through them.

**6. New rows for the motion table:**

| Event | Duration | Easing | Note |
|---|---|---|---|
| A mask aperture opening | 90ms | settle | Not snap. What is behind it is a photograph, not a flat chip, and it comes up on its own centre from 0.88 scale. |
| An arc revealing over content | 90ms per tick, 240ms lead-in | settle | Waits for the content behind it. Seven ticks is under a second. |
| A rail reporting its position | one frame | snap | Colour only. Never size, never layout. |
| A section's children lighting | 90ms each, 40ms apart | snap | One group per section. Still one group per section. |

**7. Reveals wait for what they reveal.** The hero arc opened its seven
apertures before the photograph had decoded, so on a cold load the whole gesture
was spent on an empty frame.

> A reveal that exists to disclose something must wait for that thing to be
> ready, and must carry a timeout so a failure to load never leaves the content
> hidden. This applies to masks, arcs and any first-paint sequence over media.

**8. Reduced motion is a CSS override, not a hook.** The document says
`prefers-reduced-motion` collapses everything to final states on load. True, and
it does not say how, and the how is where this went wrong twice. Trusting a
`useReducedMotion()` hook at first render paints opacity 0 before the query is
readable. Rendering plain markup and swapping in a motion component a frame
later remounts the node, so then every reader saw a flash from 1 to 0 to 1.

> Reduced motion is honoured in CSS, never by branching a component on a hook at
> render time. A hook cannot read the query before the first paint, and swapping
> one component for another remounts the node and makes the flash worse. Give
> every animated atom a class, and override that class under the media query
> with `!important`, because the motion library writes inline style.

**9. A tick may turn. It may not drift.** Nothing covered this. The law allows a
tick to light and a needle to travel, and says nothing about a tick changing
state any other way. The hero arc and the street band now turn as you scroll:
each aperture squashes along its own short axis to nothing and opens again on the
other side, staggered along the run, and the photograph behind it is a different
one when it comes back. It reads as a row of louvres, or a split-flap board.

It belongs because it is the only motion a tick can make that is still
mechanical. It rotates about its own centre, never translates, tilts, scales
overall or drifts at a rate different from the page, and it changes what you can
see rather than how it looks. That is the line between an instrument moving and
decoration moving. Proposed wording:

> A tick may turn about its own centre to change what shows through it, at
> `--d-tick` per tick with the standard stagger along the run. It may not
> translate, tilt, skew, orbit, or move at a rate different from the page.
>
> A turn is reversible where a reveal is not. A reading rises and does not fall,
> so a reveal is one-way and scanning back up must not shut it. A turn is a
> mechanism, and a mechanism runs backwards: scrolling up turns the ticks home.
>
> Two mask layers, never a crossfade. Each tick is opaque in exactly one layer
> depending on whether it has passed its half-turn, so at any moment some
> apertures show the first image and some the second. Dissolving the two
> together turns both to mud and loses the hard edge that makes each window read
> as a view of a real place.
>
> The turn must finish while the shape is still on screen. Driving the hero's
> turn off the whole section's travel was correct on paper and invisible in
> practice: the arc sits at the top of the section and had left the viewport
> before the last tick turned.

**10. One correction to the tick entrance.** The first-paint keyframe used to
scale ticks from 0.7 as well as fading them. It cannot. The engine positions
every atom with a transform attribute, and a CSS transform replaces that
attribute rather than composing with it, so scaling in CSS collapsed the whole
arc onto the viewBox origin, and `both` made it permanent. The entrance lights by
opacity only. Please state it as a rule: **the size crescendo is a static
property of the ticks; the entrance lights them, it does not resize them.** If
a tick group has to rotate, wrap it and rotate the wrapper.

**11. What stays banned, unchanged.** Parallax. Scroll hijacking, including any
sticky track that takes the scrollbar off the reader. Marquees and infinite logo
strips. Numbers counting up. Hover lift. Anything that loops. Animating `top`,
`left`, `width` or `height`: the first heat rows animated `width` from 0 to 100
percent down a six-row list and forced layout on every scroll frame, which is
exactly why the rule exists. And the law itself. The needle settles, nothing
bounces.

---

### Section 6b, Photography

The three treatments and *people are never duotoned* both stand. Add the fourth
thing photography now does here, which is the arc as a mask:

> **The arc as an aperture.** The mark's own geometry, at `fill` above 1, is the
> primary way a photograph enters this brand. The picture is seen through seven
> windows that grow toward the head, so the image is discrete at the tail and
> solid at the hot end: the instrument is reading the street rather than sitting
> next to a picture of it. Seven ticks, never more. It waits for the image to
> decode. It may turn to change images and it may not drift.

The Reading Strip rule is unchanged and is the strongest rule in the document, so
please keep it exactly as it is: if a picture cannot carry a reading, it does not
go out. The caption colour in the strip now has a token, `--tx-inv-2`.

---

### Section 7, Icons

The set is now **113 icons** in `brand/icons/currentcolor`, on the same 24px grid
with a 20px live area, 1.75px stroke, butt caps and miter joins. Two changes
worth documenting beyond the count:

**1. The set is built, not hand-maintained.** `npm run icons` builds the sprite
and the React module from the individual files, and `npm run icons:check` fails
when a glyph the product asks for was never drawn. That check exists because
three onboarding cards shipped rendering nothing at all: the config named
`bg-broadcast`, `bg-shop` and `bg-people` and none of them had ever been drawn.
A missing glyph should break the build, not the page.

**2. The rule the last set broke, restated because it keeps getting broken:** an
icon names the thing, never the abstraction. Marketplaces is a market stall
canopy, not three floating circles. Offline attribution is a billboard on two
posts, not a signal wave. Telco is a mast, not a signal wave. Fashion is a
hanger, not a shopping bag. If someone has to read the label to know what the
icon means, redraw it.

Two related failures worth a line: an icon shared between two categories is a
bug, not a saving. Real estate was sharing cutlery with quick-service
restaurants and healthcare was sharing a shield with insurance, which reads as a
mistake rather than a family. And a glyph with two ideas in it collapses at small
sizes: `bg-ask` was a terminal prompt plus a sparkle, unreadable at the 15px and
20px it was used at. It is one sparkle now.

**The set, as it maps to the product.** The eight that carry the brand types are
`bg-shelf` (FMCG), `bg-card` (fintech), `bg-venue` (venues), `bg-saas` (B2B
SaaS), `bg-market` (marketplaces), `bg-bottle` (beverage), `bg-truck`
(distribution) and `bg-creative` (agencies). Agencies is new since the artifact
was written and is now expected to be one of the largest segments, because an
agency carries many clients.

The onboarding industry list is longer than the brand types and adds `bg-mast`
(telco), `bg-camera` (media), `bg-pill` (healthcare and pharma), `bg-building`
(real estate), `bg-shield` (insurance) and `bg-hanger` (fashion). The three AI
surfaces have their own glyphs now: `bg-ask`, `bg-pre-post` and `bg-draft`, one
each, because they were sharing one.

Please also update the note in *Next actions* that says to draw industry icons
eight onward if the list grows past seven. It grew, and they are drawn.

---

### Section 9, Component contracts

**1. `StatusPill` in the error state carries `--on-hot`, not Paper**, for the
3.3:1 versus 5.3:1 reason in section 2. That includes its tick glyph. Anywhere
the document says Paper text on a Flare fill, it now says `--on-hot`.

**2. New primitive: `Crescendo`.** Every progress or score bar in the product is
one component, and it is the arc's logic laid flat: a run of ticks growing on the
0.34-to-1 ramp, carrying the heat ramp across the whole lit length. It is the
component form of the *heat spreads across the run* rule above, which is how that
rule stops being re-broken. Please add it to the contracts list alongside `Meter`.

**3. A wrap rule for chips and tags,** which the document does not have and
which produced a visible bug. A chip that is `whitespace-nowrap` and
`shrink-0` inside a two-column grid cannot shrink below its own content, so a
long tag pushes out of its column and bleeds across the panel. Proposed wording:

> A chip holding user content wraps. Set it `h-auto`, allow it to shrink, cap it
> at `max-w-full`, and give its container `min-w-0`. A chip holding a fixed label
> may stay on one line. User text is never truncated and never allowed to
> overflow its column: those are the two failure modes and wrapping is the only
> answer to both.

And the reinforcement: **round belongs to `StatusPill` alone. A tag is square.**
The tag that bled was also rounded, and both were the same instinct.

**4. `ChartState` is mandatory,** and the document should say so in the contracts
list as well as in section 5c: every chart goes through it, so it ships a
chart-shaped skeleton and an empty state that names the next action. Loading is
never a spinner.

**5. One numeric conflict to settle.** `Gauge` is specified at 56 ticks, dropping
to 28 below 160px. The mark and the motion law are both at seven. Those are
different objects and that is fine, but the document should say so in one line,
because the tick-count rule above now reads as universal and a reader will
reasonably think the `Gauge` spec is stale.

---

### A new section: dark mode is a discipline, not a palette swap

The artifact has no dark-mode section and the app needed one. Four rules, each
learned from a live defect:

1. **An inverting token can never carry fixed-inverse type.** `bg-foreground
   text-background` inverts together and stays legible. `bg-foreground` with
   `text-tx-inv` does not: in dark mode the foreground becomes ink and
   `--tx-inv` is still paper, except the pairing was written expecting a light
   ground, and the login rail measured 1.0:1. If a plane is meant to be ink on
   both grounds, pin it to `bg-ink text-tx-inv` and stop inverting it.
2. **A permanent ink plane on an ink ground needs a hairline.** Ink on ink loses
   the split entirely. One pixel at `--line` is the whole fix, and it is the
   same rule the document already has for elevation, applied to a case the
   document did not anticipate.
3. **Two-file assets render both files and switch in CSS.** The logo lockup was
   picking its ground from a prop, defaulting to Paper, and so drew a paper
   plate on every ink page. Render both and let a `dark:` variant choose. No
   flash, no hydration mismatch, and no component needs to know the theme.
4. **Measure against the raised card, not the page,** per section 2 above.

---

### A new section: the logo in motion

There is now a canonical logo animation, and it is the mark building itself
rather than a logo being animated. 3.4 seconds, 1920x1080, 30fps, three beats:

1. **The crescendo runs.** Seven ticks light from the cold tail to the hot head,
   90ms apart, each opening on its own centre.
2. **The needle sweeps and settles.** It winds back to the bottom of the scale
   and rises to the reading the mark is drawn at. It settles; it does not bounce.
3. **The wordmark is uncovered**, left to right, on a straight edge. It steps
   once every 90ms like the ticks do, and each step is longer than the one
   before it on the same 0.6-to-1 ramp: cold and short at the B, hot and long by
   the e. The crescendo is in the size of the steps, not in their shape.

Three rules come out of building it, and all three deserve to be in the document
because each was a wrong version first:

- **The letters are never bent to fit anything.** The first cut ran the wordmark
  through the arc's own apertures, and because the tick is a rounded tapered
  quadrilateral widest at its waist, the rounded corners notched the tops and
  bottoms of the glyphs. The B came out bent. The mark's geometry may reveal
  type; it may never reshape it. A wordmark unveil is a straight edge.
- **Nothing is redrawn.** The paths are read out of the lockup SVGs at render
  time and measured in the browser, and the needle's pivot is a circle fitted to
  the seven measured tick centres. That fit returns radius 115.5 and bearings
  -163.2 to -2.4 degrees, which is `GEOM.radius` and `GEOM.sweep` to the
  decimal. Change the lockup and the animation changes with it.
- **Do not re-time it by stretching the clip.** The 90ms tick interval is the
  same interval the product lights a tick at. A clip stretched to fit a slot
  stops matching the app.

Four cuts exist so nobody re-renders one: Paper, Ink, VP9 with alpha for the web,
and ProRes 4444 with alpha for an editor. Worth a line that the alpha cuts use
the Paper artwork, so over a dark plane you use the ink cut rather than the alpha
one.

---

### Section 12, Ship audit

Add these lines, each of which corresponds to a defect that shipped:

- Type on a hot plane is `--on-hot`. No Paper on Flare anywhere.
- Every text step clears 7:1 on the ground it actually sits on, and in dark mode
  that ground is the raised card.
- Nothing renders `--neu` as type.
- One green only, in its two grounds. No second green anywhere.
- A lit run carries the ramp across its whole length, not back from the head.
- Seven ticks, unless the ticks are marks on a genuinely finer scale.
- Every reveal over media waits for the media and carries a timeout.
- Reduced motion is honoured in CSS, with `!important`, on a class. No hook
  branching at render.
- No CSS transform on an element the engine has already positioned with a
  transform attribute. Wrap it instead.
- Every chip holding user content wraps. Nothing bleeds out of its column.
- Nothing is round except `StatusPill`.
- An icon names the thing. No icon is shared between two categories. No glyph
  carries two ideas.
- The screen reads correctly in dark mode, checked on both the ground and the
  raised card, not just toggled and glanced at.

And one line for the audit's existing greyscale check, which the green change
makes more important rather than less: positive and negative are 2.2:1 apart in
lightness, so the screen still has to pass in greyscale, and success is still a
filled tick plus the word.

---

### Three contradictions inside the current artifact

These are not new information from the code. They are places where the document
disagrees with itself or with what shipped, and each needs a ruling.

**1. All-caps.** Section 3 says: *No all-caps. Not for eyebrows, not for labels,
not for buttons.* But the product defines and uses `.bg-label` as uppercase
Disket 700 at 0.20em tracking, and the CSS calls it *the only place capitals are
allowed*. The two cannot both be true. My reading is that the intent was **one
sanctioned exception, not a blanket ban**, and the document should say so:
capitals belong to `.bg-label` alone, which is Disket 700 at micro size with
0.20em tracking, and nowhere else. Note that this also makes `.bg-label` the one
exception to *mono is never used for labels*, which is the second half of the
same contradiction, so please state both exceptions in the same place rather than
leaving them to be discovered separately.

**2. Deltas.** Section 9 specifies `Delta` with the glyphs `▲` and `▼`, and
section 2 uses `▼` in an example. Disket Mono has no triangles and its licence
forbids adding them, so deltas read `+` and `-` in production. Please change the
contract and the example. The principle is unchanged and is the important part:
direction is carried by the glyph, not by colour.

**3. The polarity entry in Next actions.** Item 1 asks to confirm that the
ink-versus-flare polarity call replaces green in the product. It was confirmed,
then reversed, and green is back on the terms in section 2 above. That item
should be closed and replaced with a note of the decision, so nobody reads the
open question and re-litigates it. Items 2 and 3 are also settled: the Nohemi
woff2 files are in the app at 400, 500, 700 and 800, and the mono is Disket, not
Geist.

---

## End of paste
