# Proposed amendments to the motion law

Status: proposal, not yet merged into `brand/DESIGN-SYSTEM.md`.
Written against v3.6 of the design system and v3.5 of `brand/motion.css`.

The landing page work in this branch deliberately went past the motion law in
several places, on the instruction to override where necessary and write the
overrides back afterwards. This is that write-back. Each item names the rule as
it stands, what actually shipped, and the wording proposed to replace it.

Nothing here loosens the one law. The needle still settles and nothing bounces.
What changes is the scope: the law was written for an instrument panel that a
signed-in user reads, and it is now also governing a page that a stranger
scrolls. Those are different rooms.

---

## 0. First, a housekeeping defect

There are two motion sections, **5d** and **8**, and they disagree.

- 5d: "It is the only motion that fires without a user action, and only when the
  number actually moved."
- 8: "The Brand Health Index is the only element allowed a non-user-triggered
  animation ... Never on scroll."

5d also carries three table rows (press feedback, panel, crescendo cap) that 8
does not, and 8 carries a 900ms cap on arc filling that 5d states differently.
Anyone reading the document top to bottom hits 5d first and never learns that 8
exists. **Delete section 8 and keep 5d**, folding 8's one unique sentence about
the Index into it. A rule that appears twice is a rule that will drift.

---

## 1. Scroll is allowed to be the input, when the reading is the output

**Current:** "Never on scroll." Plus a hard ban on
`window.addEventListener('scroll')`, with IntersectionObserver or
`animation-timeline: view()` named as the sanctioned alternatives.

**What shipped:** `ReadingRail` reads scroll position continuously and lights an
arc of 28 ticks from it. `HeatRow` fills a rule as its row crosses the viewport.
The product rail reads its own `scrollLeft` and draws position as a crescendo.
All three use a scroll position as a value, which is precisely what the ban was
written to prevent.

**Why it should change:** the ban is aimed at a real failure, and the failure is
not "scroll" as an input. It is decoration that moves because the page moved:
parallax, elements drifting at different rates, work done per frame on the main
thread for no informational gain. Position in a document is a genuine reading,
and this brand's whole vocabulary is for displaying a reading. Refusing to
display the one value a marketing page actually has, while owning the best
instrument on the web for displaying values, is the wrong end of the rule.

**Proposed wording:**

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

---

## 2. Heat spreads across the lit run, it is never measured back from the head

**Current:** not stated anywhere. It was assumed.

**What shipped:** the first reading rail coloured each lit tick by how far back
it sat from the head, so past four ticks everything fell onto `--tick-1`, which
is the track colour. Twenty-four of twenty-eight lit ticks rendered as unlit. It
read as a small blob sliding down the gutter rather than an arc filling. The
same mistake was available in the product rail and was avoided only because it
had just been found.

**Proposed wording:**

> A lit run carries the ramp across its whole length, from `--tick-2` at the
> tail to `--flare` at the head, rescaled every time the run grows. Heat is
> never a function of distance from the head, because that leaves a long run
> mostly in track colour and destroys the one thing the graphic is for.

---

## 3. Density is a reading, and overlap is how it is drawn

**Current:** `GEOM.fill` is documented as "share of the chord a tick occupies.
Below 1 the ticks stand apart." Above 1 is undefined.

**What shipped:** the hero photograph arrives through the mark's arc used as a
mask, at `fill: 1.35`. Because tick size already grows toward the head, an
overlap above 1 makes the apertures meet unevenly: the cold end stays discrete
and the hot end coalesces into a single mass. The picture is denser exactly
where the gauge would be hotter. This was found by accident while fixing
something else, and it is the most useful thing in the whole pass.

**Proposed wording:**

> `fill` below 1 stands the ticks apart and reads as a dial. That is the default
> and it is correct for any instrument.
>
> `fill` above 1 is reserved for the arc used as a mask or a field, where the
> ticks are apertures rather than marks. The overlap resolves unevenly along the
> growth curve, so the run reads discrete at the tail and solid at the head.
> Density is then the reading, performed by whatever shows through rather than
> drawn beside it. Do not use it on an arc that is displaying a number: two
> readings in one graphic is one too many.

---

## 4. Tick count is seven, and more is not more

**Current:** `GEOM.ticks: 7` is in the engine. Nothing says a consumer may not
pick its own count.

**What shipped:** the first mask used twenty-two to twenty-eight ticks on the
theory that a photograph needs more apertures. Backwards. More ticks makes each
window smaller, and at twenty-two a market street came out as confetti. At seven
the head aperture is about a fifth of the frame, which holds a readable slice.

**Proposed wording:**

> Seven is the mark's count and the default everywhere. Raise it only where the
> ticks are marks on a scale and the scale is genuinely finer, such as a
> long-run progress rail, and never where something has to be legible through
> them.

---

## 5. New rows for the motion table

| Event | Duration | Easing | Note |
|---|---|---|---|
| A mask aperture opening | 90ms | settle | Not snap. What is behind it is a photograph, not a flat chip, and it comes up on its own centre from 0.88 scale. |
| An arc revealing over content | 90ms per tick, 240ms lead-in | settle | Waits for the content behind it. Seven ticks is under a second. |
| A rail reporting its position | one frame | snap | Colour only. Never size, never layout. |
| A section's children lighting | 90ms each, 40ms apart | snap | One group per section. Still one group per section. |

---

## 6. Reveals wait for what they reveal

**Current:** not stated.

**What shipped:** the hero arc opened its seven apertures before the photograph
had decoded, so on a cold load the whole gesture was spent on an empty frame. It
waits for the image now, with a fallback timer so a picture that never arrives
cannot leave the mask shut.

**Proposed wording:**

> A reveal that exists to disclose something must wait for that thing to be
> ready, and must carry a timeout so a failure to load never leaves the content
> hidden. This applies to masks, arcs and any first-paint sequence over media.

---

## 7. Reduced motion is a CSS override, not a hook

**Current:** "`prefers-reduced-motion` collapses all of it to final states on
load." True, and it does not say how, and the how is where this went wrong
twice.

**What shipped:** trusting `useReducedMotion()` at first render paints opacity 0
before the media query is readable. Rendering plain markup and swapping in a
motion component a frame later remounts the node, so then every reader saw a
flash from 1 to 0 to 1. The fix is that the component never changes identity and
`.bg-lightin` in `motion.css` forces the final state with `!important`, which
beats the inline style the motion library writes.

**Proposed wording:**

> Reduced motion is honoured in CSS, never by branching a component on a hook at
> render time. A hook cannot read the query before the first paint, and swapping
> one component for another remounts the node and makes the flash worse. Give
> every animated atom a class, and override that class under the media query
> with `!important`, because the motion library writes inline style.

**Also:** `motion.css` section 5b has the comment for `.bg-lightin` but defines
the class only inside the reduced-motion block. Anyone grepping for it finds no
base rule and reasonably concludes it is dead. Add a no-op base declaration with
a comment saying the animated state is written inline by the motion library.

---

## 9. A tick may turn. It may not drift.

**Current:** nothing covers it. The law allows a tick to light and a needle to
travel, and says nothing about a tick changing state any other way.

**What shipped:** the hero arc and the street band now turn as you scroll.
Each aperture squashes along its own short axis to nothing and opens again on
the other side, staggered along the run, and the photograph behind it is a
different one when it comes back. It reads as a row of louvres, or a
split-flap board.

**Why it belongs:** this is the only motion a tick can make that is still
mechanical. It rotates about its own centre, it never translates, tilts, scales
overall or drifts at a rate different from the page, and it changes what you
can see rather than how it looks. That is the line between an instrument moving
and decoration moving, and the flip stays on the right side of it.

It is also the closest thing on this page to that line, and worth saying so
plainly rather than filing it as obviously fine.

**Proposed wording:**

> A tick may turn about its own centre to change what shows through it, at
> `--d-tick` per tick with the standard stagger along the run. It may not
> translate, tilt, skew, orbit, or move at a rate different from the page.
>
> A turn is reversible where a reveal is not. A reading rises and does not
> fall, so a reveal is one-way and scanning back up must not shut it. A turn is
> a mechanism, and a mechanism runs backwards: scrolling up turns the ticks
> home. `useScrubReveal` is the one-way hook and `useScrubValue` the
> reversible one, and picking the wrong one is a real bug either way.
>
> Two mask layers, never a crossfade. Each tick is opaque in exactly one layer
> depending on whether it has passed its half-turn, so at any moment some
> apertures show the first image and some the second. Dissolving the two
> together turns both to mud and loses the hard edge that makes each window
> read as a view of a real place.
>
> The turn must finish while the shape is still on screen. Driving the hero's
> turn off the whole section's travel was correct on paper and invisible in
> practice: the arc sits at the top of the section and had left the viewport
> before the last tick turned.

---

## 10. What stays banned, unchanged

Parallax. Scroll hijacking, including any sticky track that takes the scrollbar
off the reader. Marquees and infinite logo strips. Numbers counting up. Hover
lift. Anything that loops. Animating `top`, `left`, `width` or `height`: the
first heat rows animated `width` from 0 to 100 percent down a six-row list and
forced layout on every scroll frame, which is exactly why the rule exists.

And the law itself. The needle settles, nothing bounces.
