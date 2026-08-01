# Tell Me — cover-art film

A 3:57 video built from the single's sleeve and the record, and nothing else.
Standalone Remotion project; it shares no code with the BrandGauge app.

**Tell Me** — Dwin, The Stoic x Ṣẹwà. Produced by Nuel Beatz.

## The idea

The camera opens on the whole square sleeve, dives into the painting at 0:16,
lives inside it for the body of the record, and pulls back out to the sleeve at
3:36. While we are inside, the lagoon actually moves: the water is rebuilt from
horizontal slices of the same image, each slid and skewed by a travelling wave,
so the flamingo legs and their reflections swim. Light, grade and camera all
follow the arrangement. Nothing is added that the illustrator did not paint.

## Setup

```
npm install
npm run rasterize -- <sleeve.svg>   # -> public/cover.png at 4800px
npm run assets                      # -> public/grain.png, public/title-mask.png
npm run analyze                     # -> src/audio-analysis.json
npm run render                      # -> out/tell-me.mp4
```

`analyze` and `assets` only need re-running if the audio or the artwork change.
Their output is committed so a render never depends on decoding either.

## Assets

`public/cover.png` is rasterised from the `.svg` master rather than taken from
the 3000px `.png` export, because the export loses two things: the credits are
still vector in the `.svg`, and the painting is embedded there at 4096px but
squeezed into a 2316px panel by the export. Going through the browser recovers
both, which is what keeps the close-ups sharp — the tightest shot renders the
panel at ~3560px, so it is still downsampling.

`public/title-mask.png` is the silhouette of the hand-lettered title and the
cloud behind it, cut from the artwork by `scripts/make-title-mask.mjs`. The
wordmark sits low in the panel, exactly where the ripple is strongest, so
without this the lettering visibly wobbles — about 17px at mid zoom. The film
paints a still copy of the sleeve back over the ripple through this mask.

Two details in that script are deliberate. The size filter is tuned so the
white segments of the life ring do *not* survive, because masking only its
white stripes would freeze half the ring while the red half rippled; the ring
floats on the water and should move with it. And the mask edge is left nearly
hard, because cross-fading between a rippling and a still copy of the same
water ghosts — the two differ by the ripple offset.

## How the film is timed

`scripts/analyze-audio.mjs` decodes the mp3 to PCM, runs an STFT, and derives:

- tempo and a beat grid (77.1 BPM on this track),
- per-frame low / mid / high band energy and an onset curve,
- a smoothed arrangement-energy curve.

It prints an energy map at 4-second resolution, which is what the camera
keyframes in `src/camera.ts` are cut against:

| Time | Energy | Section |
| --- | --- | --- |
| 0:00–0:16 | 0.23 → 0.77 | intro, beat enters ~0:04 |
| 0:16–0:32 | 0.77 | first full section |
| 0:32–0:56 | 0.53 | verse, bass drops out |
| 0:56–1:44 | 0.85 | chorus |
| 1:44–2:08 | 0.60 | breakdown |
| 2:08–2:58 | 0.89, peak 0.96 at 2:20 | climax |
| 2:58–3:36 | 0.55, highs to 0.74 | airy outro, bass gone |
| 3:36–3:57 | fading | tail |

Every camera landmark is snapped to the detected beat grid so moves land with
the track rather than near it.

## Layout

| Path | What |
| --- | --- |
| `src/art.ts` | the only place that describes this specific painting — panel bounds, waterline |
| `src/camera.ts` | the keyframed move, spline interpolation, and the clamp that keeps the border out of shot |
| `src/audio.ts` | typed read layer over the analysis |
| `src/layers/Water.tsx` | the lagoon, made to move |
| `src/layers/Atmosphere.tsx` | bloom, sun shafts, drifting motes |
| `src/layers/Grade.tsx` | colour grade, vignette, grain, top-and-tail fades |

`src/art.ts` holds measured numbers, not estimates. Re-derive them with
`npm run probe`, which reports the panel bounds and scans for the waterline.
The panel is `0.114–0.886` square, matching the `342,330 2316x2316` rect the
designer placed in the `.svg`.

Two constraints the camera has to respect, both learned the hard way:

- Scale above 1.0 crops the sleeve, because the square cannot fit a 1080-tall
  frame, and the credits fall outside. The sleeve shots sit at 0.90–0.985.
- Once the panel can cover the frame it is held covering the frame, so no cream
  border creeps into a close shot. The exception is the closing beat on the
  title, which the illustrator drew hanging off the panel onto the cream and
  which therefore cannot be framed properly from inside the panel at all. Those
  keys are marked `free`.

## Rendering notes

No GPU and four cores here, so the render is software-rasterised and slow.
Remotion's own Chrome download is blocked by the network policy, so
`remotion.config.ts` points at the Chromium that ships with the image;
override with `REMOTION_BROWSER_EXECUTABLE` elsewhere.

Layers can be switched off to time them individually:

```
npm run render -- --props='{"layers":{"water":false}}'
```

Measured cost per 60 frames against a 2400px stand-in: water 25s, atmosphere
14s, grade 13s, picture 6s. Two findings worth keeping:

- The grade runs as a `backdrop-filter` on a frame-sized element, not as a
  `filter` on the picture. As a filter it made Chromium rasterise the whole
  square — up to 4,500px a side — to show a 1920x1080 crop. It also turns out
  to make the render *faster*, because it flattens the stack underneath it for
  the blend layers above.
- Per-slice `filter: brightness()` on the water gave Chromium 56 separate
  layers to composite every frame. One drifting sheen overlay reads the same
  for a fraction of the cost.
